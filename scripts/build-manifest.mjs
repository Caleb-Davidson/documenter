import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  buildManifest,
  diffManifestAgainstDisk,
  MANIFEST_FILENAME,
  readCliVersion,
  writeManifest
} from "../src/lib/manifest.mjs";
import { PACKAGE_ROOT, TEMPLATE_ROOT } from "../src/lib/paths.mjs";

// Maintainer script: re-hashes every file under template/ and writes template/manifest.json.
// Run this after sync-vendor or after editing anything in template/.
//
// --check is the gate's read-only counterpart: it reports whether the committed manifest
// still describes template/ and fails if not, without writing (a rewrite would bury the
// staleness it is meant to surface, and churn generatedAt on every gate run).

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    check: { type: "boolean", default: false },
    root: { type: "string" }
  },
  allowPositionals: false
});

const cliVersion = await readCliVersion(PACKAGE_ROOT);
// --root points both branches at an alternate template tree; the tests use it so exercising
// this script never writes into the tracked template/.
const templateRoot = values.root === undefined ? TEMPLATE_ROOT : resolve(values.root);
const manifestPath = join(templateRoot, MANIFEST_FILENAME);

if (values.check) {
  const diff = await diffManifestAgainstDisk(templateRoot, cliVersion);
  const findings = [
    ...diff.missing.map((relPath) => `missing from manifest  ${relPath}`),
    ...diff.stale.map((relPath) => `content changed        ${relPath}`),
    ...diff.extra.map((relPath) => `gone from template     ${relPath}`)
  ];
  if (diff.versionChanged) {
    findings.push(
      `documenterVersion      ${diff.versionChanged.recorded} → expected ${diff.versionChanged.expected}`
    );
  }

  if (findings.length > 0) {
    console.error(`${manifestPath} is out of date:`);
    for (const finding of findings) console.error(`  ${finding}`);
    console.error(`Run 'npm run manifest' and commit the regenerated manifest.`);
    process.exit(1);
  }

  console.log(`${manifestPath} is up to date for documenter ${cliVersion}.`);
} else {
  const manifest = await buildManifest(templateRoot, cliVersion);
  await writeManifest(manifestPath, manifest);

  console.log(`Wrote ${manifestPath}`);
  console.log(`  documenterVersion: ${manifest.documenterVersion}`);
  console.log(`  files: ${Object.keys(manifest.files).length}`);
}
