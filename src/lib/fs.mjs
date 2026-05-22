import { access, copyFile, mkdir, readdir } from "node:fs/promises";
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
