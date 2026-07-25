import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Maintainer script: copies browser-ready library bundles from documenter's own
// node_modules into template/docs/assets/vendor/ so they are committed alongside
// the CLI and ship deterministically to target projects.

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const vendorDir = resolve(repoRoot, "template/docs/assets/vendor");
const versionsFile = resolve(vendorDir, "versions.json");

const vendorPackages = [
  {
    pkg: "markdown-it",
    from: resolve(repoRoot, "node_modules/markdown-it/dist/markdown-it.min.js"),
    to: resolve(vendorDir, "markdown-it.min.js")
  },
  {
    pkg: "dompurify",
    from: resolve(repoRoot, "node_modules/dompurify/dist/purify.min.js"),
    to: resolve(vendorDir, "purify.min.js")
  },
  {
    pkg: "js-yaml",
    from: resolve(repoRoot, "node_modules/js-yaml/dist/js-yaml.min.js"),
    to: resolve(vendorDir, "js-yaml.min.js")
  },
  {
    pkg: "mermaid",
    from: resolve(repoRoot, "node_modules/mermaid/dist/mermaid.min.js"),
    to: resolve(vendorDir, "mermaid.min.js")
  }
];

await mkdir(vendorDir, { recursive: true });
await Promise.all(vendorPackages.map((entry) => copyFile(entry.from, entry.to)));

const versions = {};
for (const entry of vendorPackages) {
  versions[entry.pkg] = await readInstalledPackageVersion(entry.pkg);
}
await writeFile(versionsFile, JSON.stringify(versions, null, 2) + "\n", "utf-8");

console.log(`Synced ${vendorPackages.length} vendor bundles into template/docs/assets/vendor/`);
console.log(`Now run 'npm run manifest' to refresh template/manifest.json.`);

async function readInstalledPackageVersion(packageName) {
  const packageJsonPath = resolve(repoRoot, "node_modules", packageName, "package.json");
  const packageJsonText = await readFile(packageJsonPath, "utf-8");
  return JSON.parse(packageJsonText).version;
}
