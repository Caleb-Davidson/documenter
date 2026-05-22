import { readFile, writeFile } from "node:fs/promises";

export const REQUIRED_SCRIPTS = {
  "docs:lint": "documenter lint"
};

export async function readPackageJson(path) {
  return JSON.parse(await readFile(path, "utf-8"));
}

export async function writePackageJson(path, pkg) {
  await writeFile(path, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

/**
 * Additively merge required scripts into a package.json without touching existing keys.
 *
 * @param {object} pkg
 * @returns {{ merged: object, changes: { scripts: string[] } }}
 */
export function mergeDocsScaffold(pkg) {
  const merged = { ...pkg };
  const changes = { scripts: [] };

  merged.scripts = { ...(pkg.scripts ?? {}) };
  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
    if (!(name in merged.scripts)) {
      merged.scripts[name] = command;
      changes.scripts.push(name);
    }
  }

  return { merged, changes };
}

export function minimalPackageJson(name) {
  return {
    name,
    version: "0.0.0",
    private: true,
    scripts: { ...REQUIRED_SCRIPTS }
  };
}
