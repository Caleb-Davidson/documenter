import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { exists } from "./fs.mjs";

export const MANIFEST_FILENAME = "manifest.json";
export const STATE_FILENAME = ".documenter.json";

/**
 * Extensions whose 0x0D bytes are line endings, not data. Hashing normalizes
 * CRLF/CR to LF for these so drift detection tracks content, not line endings
 * (git autocrlf, editors, and formatters all rewrite EOLs and documenter can't
 * control them). Anything not listed falls back to a NUL-byte sniff.
 */
const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
  ".json", ".yml", ".yaml", ".svg", ".xml", ".csv"
]);

/**
 * Decide whether a file's content should be hashed as text (line-ending normalized)
 * or as raw bytes. Extension allowlist first; for unknown extensions, treat a file
 * as binary only if its head contains a NUL byte.
 *
 * @param {string} relPath POSIX-normalized relative path (used for the extension).
 * @param {Buffer} buf File contents.
 * @returns {boolean}
 */
export function isTextFile(relPath, buf) {
  if (TEXT_EXTENSIONS.has(extname(relPath).toLowerCase())) return true;
  const head = buf.subarray(0, Math.min(buf.length, 8000));
  return !head.includes(0x00);
}

/**
 * Content hash + size for a buffer, line-ending agnostic for text files.
 *
 * Text files: CRLF and lone CR are normalized to LF before hashing, so identical
 * content hashes the same regardless of the EOLs git/editors happened to write.
 * Binary files: raw bytes are hashed unchanged (a 0x0D in a PNG/font is data, not
 * a newline; normalizing it would corrupt the hash).
 *
 * This is the single helper both the record-time path (buildManifest) and the
 * check-time path (update) route through, so the two can't diverge again.
 *
 * @param {Buffer} buf
 * @param {boolean} isText
 * @returns {{ sha256: string, size: number }}
 */
export function hashBuffer(buf, isText) {
  const data = isText
    ? Buffer.from(buf.toString("utf-8").replace(/\r\n?/g, "\n"), "utf-8")
    : buf;
  return { sha256: createHash("sha256").update(data).digest("hex"), size: data.length };
}

/**
 * SHA-256 hex digest of a file's content. Line endings are normalized first for
 * text files; binary files are hashed raw. See {@link hashBuffer}.
 *
 * @param {string} path
 * @param {boolean} isText
 * @returns {Promise<string>}
 */
export async function hashFile(path, isText) {
  const buf = await readFile(path);
  return hashBuffer(buf, isText).sha256;
}

/**
 * Walk a directory recursively and return file entries (relative to root) and their stat sizes.
 * Excludes any path for which the optional predicate returns true.
 *
 * @param {string} root
 * @param {(relativePath: string) => boolean} [exclude]
 * @returns {Promise<{ relativePath: string, absolutePath: string, size: number }[]>}
 */
export async function walkFiles(root, exclude = () => false) {
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = toPosix(relative(root, abs));
      if (exclude(rel)) continue;
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const st = await stat(abs);
        results.push({ relativePath: rel, absolutePath: abs, size: st.size });
      }
    }
  }

  await walk(root);
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}

function toPosix(p) {
  return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * Build a manifest object for the given root by hashing every file (excluding the manifest itself).
 *
 * Each entry records `isText`, decided here and consumed by both init and update so
 * the text/binary decision is never re-sniffed (and never disagrees) across paths.
 *
 * @param {string} root
 * @param {string} cliVersion
 * @returns {Promise<{ documenterVersion: string, generatedAt: string, files: Record<string, { sha256: string, size: number, isText: boolean }> }>}
 */
export async function buildManifest(root, cliVersion) {
  const entries = await walkFiles(root, (rel) => rel === MANIFEST_FILENAME);
  const files = {};
  for (const entry of entries) {
    const buf = await readFile(entry.absolutePath);
    const isText = isTextFile(entry.relativePath, buf);
    const { sha256, size } = hashBuffer(buf, isText);
    files[entry.relativePath] = { sha256, size, isText };
  }
  return {
    documenterVersion: cliVersion,
    generatedAt: new Date().toISOString(),
    files
  };
}

/**
 * Compare the manifest committed under `root` against a fresh hash of that tree, so a
 * caller can tell whether `npm run manifest` still needs to run. `generatedAt` is
 * ignored: it changes on every regeneration and says nothing about the recorded hashes.
 *
 * A root with no manifest at all reads as one recording nothing, so every file on disk
 * comes back as `missing`.
 *
 * @param {string} root Template root holding both the tree and its manifest.
 * @param {string} cliVersion Version the manifest is expected to record.
 * @returns {Promise<{ stale: string[], missing: string[], extra: string[], versionChanged: { recorded: string, expected: string } | null }>}
 *   `stale`: recorded differently than a rebuild would record it. `missing`: on disk but
 *   unrecorded. `extra`: recorded but gone from disk. All three POSIX-separated and sorted.
 */
export async function diffManifestAgainstDisk(root, cliVersion) {
  const rebuilt = await buildManifest(root, cliVersion);
  const committed =
    (await readManifest(join(root, MANIFEST_FILENAME))) ?? { documenterVersion: cliVersion, files: {} };

  const stale = [];
  const missing = [];
  for (const [relPath, info] of Object.entries(rebuilt.files)) {
    const recorded = committed.files[relPath];
    if (!recorded) missing.push(relPath);
    else if (!recordsSameEntry(recorded, info)) stale.push(relPath);
  }

  return {
    stale: stale.sort(),
    missing: missing.sort(),
    extra: Object.keys(committed.files).filter((relPath) => !(relPath in rebuilt.files)).sort(),
    versionChanged:
      committed.documenterVersion === cliVersion
        ? null
        : { recorded: committed.documenterVersion, expected: cliVersion }
  };
}

/**
 * Whether a committed manifest entry still matches what a rebuild produces.
 *
 * The whole entry is compared, not just `sha256`: a CR-free file hashes identically
 * whether it was treated as text or binary, so an `isTextFile()` change that flips
 * `isText` would otherwise be invisible here — and `update` reads `isText` to pick the
 * line ending it writes with, so a wrong flag rewrites EOLs in a binary file.
 *
 * @param {{ sha256: string, size: number, isText: boolean }} recorded Entry from the committed manifest.
 * @param {{ sha256: string, size: number, isText: boolean }} rebuilt Entry a rebuild produces.
 * @returns {boolean}
 */
function recordsSameEntry(recorded, rebuilt) {
  return (
    recorded.sha256 === rebuilt.sha256 &&
    recorded.size === rebuilt.size &&
    recorded.isText === rebuilt.isText
  );
}

export async function readManifest(path) {
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf-8"));
}

export async function writeManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

/**
 * Per-target state file recording the hash of each managed file at the time documenter
 * last wrote it. Used by `update` to detect drift.
 *
 * @typedef {{ documenterVersion: string, lastSyncedAt: string, managedFiles: Record<string, { sha256: string, writtenBy: string, writtenAt: string }> }} DocumenterState
 */

/**
 * @param {string} targetRoot
 * @returns {Promise<DocumenterState | null>}
 */
export async function readState(targetRoot) {
  const path = join(targetRoot, STATE_FILENAME);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} targetRoot
 * @param {DocumenterState} state
 */
export async function writeState(targetRoot, state) {
  const path = join(targetRoot, STATE_FILENAME);
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function newState(cliVersion) {
  return {
    documenterVersion: cliVersion,
    lastSyncedAt: new Date().toISOString(),
    managedFiles: {}
  };
}

/**
 * Read the CLI's package.json version from disk.
 *
 * @param {string} packageRoot
 * @returns {Promise<string>}
 */
export async function readCliVersion(packageRoot) {
  const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf-8"));
  return pkg.version;
}
