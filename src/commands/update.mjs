import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createEolResolver } from "../lib/eol.mjs";
import { exists, writeManagedFile } from "../lib/fs.mjs";
import {
  hashFile,
  MANIFEST_FILENAME,
  newState,
  readCliVersion,
  readManifest,
  readState,
  writeState
} from "../lib/manifest.mjs";
import {
  mergeDocsScaffold,
  readPackageJson,
  writePackageJson
} from "../lib/package-json.mjs";
import { PACKAGE_ROOT, TEMPLATE_ROOT } from "../lib/paths.mjs";

/**
 * Classification of a managed file's state in the target project relative to the CLI manifest.
 *
 * - `new`: file is in the CLI manifest but missing from the target → copy.
 * - `current`: target file hash matches the CLI manifest → skip (already up to date).
 * - `stock-old`: target file hash matches the state record (untouched since last write) but
 *   differs from the CLI manifest → safe to update.
 * - `drifted`: target file hash differs from both the state record and the CLI manifest
 *   (or no state record exists and target content differs from CLI) → user-modified,
 *   skip unless --force.
 *
 * @typedef {'new' | 'current' | 'stock-old' | 'drifted'} FileClassification
 */

export async function runUpdate(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      cwd: { type: "string" },
      force: { type: "boolean", default: false },
      check: { type: "boolean", default: false }
    },
    allowPositionals: false
  });

  const target = resolve(values.cwd ?? process.cwd());
  const cliVersion = await readCliVersion(PACKAGE_ROOT);

  console.log(`documenter update → ${target}`);
  console.log(`  CLI version: ${cliVersion}`);
  if (values.force) console.log(`  --force: drifted files will be overwritten`);

  const manifestPath = join(TEMPLATE_ROOT, MANIFEST_FILENAME);
  const manifest = await readManifest(manifestPath);
  if (!manifest) {
    throw new Error(
      `template manifest not found at ${manifestPath}. Run 'npm run manifest' in the documenter repo.`
    );
  }

  const priorState = (await readState(target)) ?? newState(cliVersion);
  const nextState = newState(cliVersion);
  const eolResolver = await createEolResolver(target);

  /** Write a managed file from the template using the target's preferred EOL. */
  async function writeFromTemplate(src, dest, relPath, info) {
    if (values.check) return; // --check classifies the whole tree but touches nothing
    const isText = info.isText ?? true;
    const eol = isText ? await eolResolver.eolFor(relPath) : "\n";
    await writeManagedFile(src, dest, { isText, eol });
  }

  const reports = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let drifted = 0;
  let forced = 0;

  for (const [relPath, info] of Object.entries(manifest.files)) {
    const src = join(TEMPLATE_ROOT, relPath);
    const dest = join(target, relPath);
    const expected = priorState.managedFiles?.[relPath]?.sha256 ?? null;
    const newHash = info.sha256;
    const current = (await exists(dest)) ? await hashFile(dest, info.isText ?? true) : null;

    const classification = classify({ current, expected, newHash });

    if (classification === "new") {
      await writeFromTemplate(src, dest, relPath, info);
      added += 1;
      reports.push({ classification, path: relPath });
      nextState.managedFiles[relPath] = { sha256: newHash, writtenBy: cliVersion, writtenAt: nextState.lastSyncedAt };
      continue;
    }

    if (classification === "current") {
      unchanged += 1;
      nextState.managedFiles[relPath] = { sha256: newHash, writtenBy: cliVersion, writtenAt: priorState.managedFiles?.[relPath]?.writtenAt ?? nextState.lastSyncedAt };
      continue;
    }

    if (classification === "stock-old") {
      await writeFromTemplate(src, dest, relPath, info);
      updated += 1;
      reports.push({ classification, path: relPath });
      nextState.managedFiles[relPath] = { sha256: newHash, writtenBy: cliVersion, writtenAt: nextState.lastSyncedAt };
      continue;
    }

    // drifted
    if (values.force) {
      await writeFromTemplate(src, dest, relPath, info);
      forced += 1;
      reports.push({ classification: "forced", path: relPath });
      nextState.managedFiles[relPath] = { sha256: newHash, writtenBy: cliVersion, writtenAt: nextState.lastSyncedAt };
    } else {
      drifted += 1;
      reports.push({ classification, path: relPath });
      // Preserve the prior state entry verbatim so a revert to stock is detectable next run.
      const prior = priorState.managedFiles?.[relPath];
      if (prior) nextState.managedFiles[relPath] = prior;
    }
  }

  if (values.check) {
    const pending = pendingChanges(reports, priorState.managedFiles ?? {}, nextState.managedFiles);
    console.log("");
    if (pending.length === 0) {
      console.log(`--check: ${unchanged} managed files current, ${drifted} drifted (user-owned).`);
      return;
    }
    console.log("--check: this target is out of date. A real update would:");
    for (const line of pending) console.log(`  ${line}`);
    throw new Error("managed files are out of date — run 'documenter update' and commit the result.");
  }

  await writeState(target, nextState);

  const pkgSummary = await syncPackageJson(target);

  console.log("");
  console.log(`Added (new files):       ${added}`);
  console.log(`Updated (stock → new):   ${updated}`);
  if (forced > 0) console.log(`Force-overwritten:       ${forced}`);
  console.log(`Unchanged (already current): ${unchanged}`);
  console.log(`Drifted (skipped):       ${drifted}${drifted > 0 ? " — use --force to overwrite" : ""}`);
  console.log(`package.json:            ${pkgSummary}`);

  if (drifted > 0 || reports.length > 0) {
    console.log("");
    console.log("Details:");
    for (const r of reports) {
      const label = {
        "new": "added",
        "stock-old": "updated",
        "drifted": "skipped (drifted)",
        "forced": "force-overwritten"
      }[r.classification] ?? r.classification;
      console.log(`  ${label.padEnd(20)} ${r.path}`);
    }
  }
}

/**
 * What a real update would change in the target, one report line each. Empty means the
 * target is current.
 *
 * Drifted files are left out on purpose: a user-owned edit is the expected steady state,
 * not staleness. A recorded hash that differs from what this run would record is included —
 * it means a managed file changed hands without going through the CLI.
 *
 * @param {{ classification: string, path: string }[]} reports Per-file classifications from the pass above.
 * @param {Record<string, { sha256: string }>} priorFiles `managedFiles` recorded in the target's state.
 * @param {Record<string, { sha256: string }>} nextFiles `managedFiles` this run would record.
 * @returns {string[]}
 */
function pendingChanges(reports, priorFiles, nextFiles) {
  const writes = reports
    .filter((r) => r.classification === "new" || r.classification === "stock-old")
    .map((r) => `${(r.classification === "new" ? "add" : "update").padEnd(18)}${r.path}`);
  const restated = Object.keys({ ...priorFiles, ...nextFiles })
    .filter((relPath) => priorFiles[relPath]?.sha256 !== nextFiles[relPath]?.sha256)
    .sort()
    .map((relPath) => `${"re-record state".padEnd(18)}${relPath}`);
  return [...writes, ...restated];
}

/**
 * @param {{ current: string | null, expected: string | null, newHash: string }} input
 * @returns {FileClassification}
 */
function classify({ current, expected, newHash }) {
  if (current === null) return "new";
  if (current === newHash) return "current";
  if (expected !== null && current === expected) return "stock-old";
  return "drifted";
}

async function syncPackageJson(target) {
  const pkgPath = join(target, "package.json");
  if (!(await exists(pkgPath))) return "not found — skipped";
  const existing = await readPackageJson(pkgPath);
  const { merged, changes } = mergeDocsScaffold(existing);
  if (changes.scripts.length === 0) return "already current";
  await writePackageJson(pkgPath, merged);
  return `added scripts: ${changes.scripts.join(", ")}`;
}
