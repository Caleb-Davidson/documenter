import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { exists } from "./fs.mjs";

export const MANIFEST_FILENAME = "manifest.json";
export const STATE_FILENAME = ".documenter.json";

/**
 * SHA-256 hex digest of a file's bytes.
 *
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function hashFile(path) {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
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
 * @param {string} root
 * @param {string} cliVersion
 * @returns {Promise<{ documenterVersion: string, generatedAt: string, files: Record<string, { sha256: string, size: number }> }>}
 */
export async function buildManifest(root, cliVersion) {
  const entries = await walkFiles(root, (rel) => rel === MANIFEST_FILENAME);
  const files = {};
  for (const entry of entries) {
    files[entry.relativePath] = {
      sha256: await hashFile(entry.absolutePath),
      size: entry.size
    };
  }
  return {
    documenterVersion: cliVersion,
    generatedAt: new Date().toISOString(),
    files
  };
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
