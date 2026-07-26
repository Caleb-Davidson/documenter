import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a managed file from the template to a target path, creating parent dirs.
 *
 * Text files are normalized to LF and re-emitted with the requested `eol`, so the
 * output matches the target repo's line-ending convention regardless of how the
 * template happens to be checked out. Binary files are copied byte-for-byte.
 *
 * @param {string} src Template source path.
 * @param {string} dest Target destination path.
 * @param {object} opts
 * @param {boolean} opts.isText Whether the file is text (from the manifest).
 * @param {string} opts.eol Line ending to write for text files ("\n" or "\r\n").
 * @returns {Promise<void>}
 */
export async function writeManagedFile(src, dest, { isText, eol }) {
  await mkdir(dirname(dest), { recursive: true });
  if (!isText) {
    await copyFile(src, dest);
    return;
  }
  const normalized = (await readFile(src, "utf-8")).replace(/\r\n?/g, "\n");
  const out = eol === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized;
  await writeFile(dest, out, "utf-8");
}

/**
 * Write generated/transformed text content to a managed target path.
 *
 * Mirrors {@link writeManagedFile}'s line-ending handling — normalizes to LF then
 * re-emits with the requested `eol` — but takes an in-memory string instead of a
 * source file. Use when a managed file is produced by transforming template
 * content (e.g. injecting a title) rather than copied byte-for-byte.
 *
 * @param {string} dest Target destination path.
 * @param {string} text Content to write.
 * @param {object} opts
 * @param {string} opts.eol Line ending to write ("\n" or "\r\n").
 * @returns {Promise<void>}
 */
export async function writeManagedText(dest, text, { eol }) {
  await mkdir(dirname(dest), { recursive: true });
  const normalized = String(text).replace(/\r\n?/g, "\n");
  const out = eol === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized;
  await writeFile(dest, out, "utf-8");
}

/**
 * Copy a directory tree from srcRoot into destRoot.
 *
 * @param {string} srcRoot Source directory.
 * @param {string} destRoot Destination directory.
 * @param {object} [opts]
 * @param {boolean} [opts.force] If true, overwrite existing files. Default false.
 * @param {(relativePath: string) => boolean} [opts.exclude] Return true to skip a file/dir.
 * @returns {Promise<{ copied: string[], skipped: string[] }>} Lists of files written and skipped, as srcRoot-relative paths.
 */
export async function copyTree(srcRoot, destRoot, opts = {}) {
  const { force = false, exclude = () => false } = opts;
  const stats = { copied: [], skipped: [] };

  await mkdir(destRoot, { recursive: true });
  await walk(srcRoot, destRoot);
  return stats;

  async function walk(srcDir, destDir) {
    const entries = await readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      const rel = relative(srcRoot, srcPath);
      if (exclude(rel)) continue;

      if (entry.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await walk(srcPath, destPath);
      } else if (entry.isFile()) {
        if ((await exists(destPath)) && !force) {
          stats.skipped.push(rel);
        } else {
          await mkdir(dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
          stats.copied.push(rel);
        }
      }
    }
  }
}
