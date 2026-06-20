import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createEolResolver } from "../lib/eol.mjs";
import { exists, writeManagedFile } from "../lib/fs.mjs";
import {
  MANIFEST_FILENAME,
  newState,
  readCliVersion,
  readManifest,
  writeState
} from "../lib/manifest.mjs";
import {
  mergeDocsScaffold,
  minimalPackageJson,
  readPackageJson,
  writePackageJson
} from "../lib/package-json.mjs";
import { PACKAGE_ROOT, TEMPLATE_ROOT } from "../lib/paths.mjs";

export async function runInit(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      cwd: { type: "string" },
      force: { type: "boolean", default: false }
    },
    allowPositionals: false
  });

  const target = resolve(values.cwd ?? process.cwd());
  const cliVersion = await readCliVersion(PACKAGE_ROOT);

  console.log(`documenter init → ${target}`);
  console.log(`  CLI version: ${cliVersion}`);
  if (values.force) console.log(`  --force: existing files will be overwritten`);

  const manifestPath = join(TEMPLATE_ROOT, MANIFEST_FILENAME);
  const manifest = await readManifest(manifestPath);
  if (!manifest) {
    throw new Error(
      `template manifest not found at ${manifestPath}. Run 'npm run manifest' in the documenter repo.`
    );
  }

  const eolResolver = await createEolResolver(target);
  const state = newState(cliVersion);
  let copied = 0;
  let skipped = 0;

  for (const [relPath, info] of Object.entries(manifest.files)) {
    const src = join(TEMPLATE_ROOT, relPath);
    const dest = join(target, relPath);
    const present = await exists(dest);
    if (present && !values.force) {
      // File already existed; documenter didn't write it. Leave it untracked in state
      // so update will classify any future content here as "drifted" rather than claim ownership.
      skipped += 1;
      continue;
    }
    const isText = info.isText ?? true;
    const eol = isText ? await eolResolver.eolFor(relPath) : "\n";
    await writeManagedFile(src, dest, { isText, eol });
    copied += 1;
    state.managedFiles[relPath] = {
      sha256: info.sha256,
      writtenBy: cliVersion,
      writtenAt: state.lastSyncedAt
    };
  }

  await writeState(target, state);

  const pkgSummary = await syncPackageJson(target);

  console.log("");
  console.log(`Files written:  ${copied}`);
  console.log(`Files skipped:  ${skipped} ${skipped > 0 && !values.force ? "(already existed — use --force to overwrite)" : ""}`.trim());
  console.log(`State file:     .documenter.json written (${Object.keys(state.managedFiles).length} managed files)`);
  console.log(`package.json:   ${pkgSummary}`);
  console.log("");
  console.log("Next steps:");
  console.log("  - documenter lint           # validate the docs structure");
  console.log("  - open docs/index.html      # preview the docs shell locally");
  console.log("  - Edit docs/index.md to curate which pages appear in nav.");
}

async function syncPackageJson(target) {
  const pkgPath = join(target, "package.json");
  if (!(await exists(pkgPath))) {
    const pkg = minimalPackageJson(basename(target));
    await writePackageJson(pkgPath, pkg);
    return "created (minimal package.json with docs:lint script)";
  }

  const existing = await readPackageJson(pkgPath);
  const { merged, changes } = mergeDocsScaffold(existing);
  if (changes.scripts.length === 0) {
    return "already has docs:lint script (no changes)";
  }
  await writePackageJson(pkgPath, merged);
  return `updated (added scripts: ${changes.scripts.join(", ")})`;
}
