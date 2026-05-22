import { join } from "node:path";
import { buildManifest, MANIFEST_FILENAME, readCliVersion, writeManifest } from "../src/lib/manifest.mjs";
import { PACKAGE_ROOT, TEMPLATE_ROOT } from "../src/lib/paths.mjs";

// Maintainer script: re-hashes every file under template/ and writes template/manifest.json.
// Run this after sync-vendor or after editing anything in template/.

const cliVersion = await readCliVersion(PACKAGE_ROOT);
const manifest = await buildManifest(TEMPLATE_ROOT, cliVersion);
const manifestPath = join(TEMPLATE_ROOT, MANIFEST_FILENAME);
await writeManifest(manifestPath, manifest);

const count = Object.keys(manifest.files).length;
console.log(`Wrote ${manifestPath}`);
console.log(`  documenterVersion: ${manifest.documenterVersion}`);
console.log(`  files: ${count}`);
