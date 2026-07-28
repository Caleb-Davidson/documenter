import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  buildManifest,
  diffManifestAgainstDisk,
  hashBuffer,
  MANIFEST_FILENAME,
  readCliVersion,
  readState,
  STATE_FILENAME,
  writeManifest,
  writeState
} from "../src/lib/manifest.mjs";
import { PACKAGE_ROOT } from "../src/lib/paths.mjs";

// Covers the two "generated files are current" gate checks: `build-manifest.mjs
// --check` (is template/manifest.json in sync with template/?) and `documenter
// update --check` (would dogfooding update change the target's docs/ or state?).
//
// The manifest comparison is exercised as a library function against temp-dir
// template fixtures; both check modes are additionally driven through their real
// entry points so exit codes and remediation output are part of the contract.
//
// Every manifest case runs against a synthesized template root via --root. The
// tracked template/ is never read or written here: the gate runs its own manifest
// check over it in parallel with this suite, so touching it would make the two race.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const CLI = join(REPO_ROOT, "bin", "documenter.mjs");
const BUILD_MANIFEST = join(REPO_ROOT, "scripts", "build-manifest.mjs");

// A version the fixtures own outright, so a real version bump can never make the
// documenterVersion cases pass or fail for the wrong reason.
const FIXTURE_VERSION = "9.9.9";

const TEMPLATE_FIXTURE = {
  "docs/index.md": "# Fixture docs\n",
  "docs/assets/style.css": "body { margin: 0; }\n"
};

/**
 * Materializes a template root in a fresh temp dir, writes a manifest.json that
 * matches it exactly, lets `mutate` make that manifest stale, and returns the diff.
 *
 * @param {{ files: Record<string, string>, mutate?: (root: string) => unknown, expectedVersion?: string }} options
 */
async function diffAfter({ files, mutate = () => {}, expectedVersion = FIXTURE_VERSION }) {
  const root = mkdtempSync(join(tmpdir(), "documenter-manifest-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, "utf-8");
    }
    await writeManifest(join(root, MANIFEST_FILENAME), await buildManifest(root, FIXTURE_VERSION));

    await mutate(root);

    return await diffManifestAgainstDisk(root, expectedVersion);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("manifest diff is empty when the committed manifest matches the template tree", async () => {
  const diff = await diffAfter({ files: TEMPLATE_FIXTURE });

  assert.deepEqual(diff, { stale: [], missing: [], extra: [], versionChanged: null });
});

test("manifest diff reports a template file whose content changed after the manifest was written", async () => {
  const diff = await diffAfter({
    files: TEMPLATE_FIXTURE,
    mutate: (root) => writeFileSync(join(root, "docs", "index.md"), "# Fixture docs, revised\n", "utf-8")
  });

  assert.deepEqual(diff, { stale: ["docs/index.md"], missing: [], extra: [], versionChanged: null });
});

test("manifest diff reports an entry whose isText flag no longer matches the tree", async () => {
  const diff = await diffAfter({
    files: TEMPLATE_FIXTURE,
    mutate: async (root) => {
      const path = join(root, MANIFEST_FILENAME);
      const manifest = JSON.parse(readFileSync(path, "utf-8"));
      // A CR-free file hashes identically as text or as raw bytes, so sha256 alone
      // cannot see this flip — yet init and update read isText to decide EOL handling.
      manifest.files["docs/assets/style.css"].isText = false;
      await writeManifest(path, manifest);
    }
  });

  assert.deepEqual(diff, { stale: ["docs/assets/style.css"], missing: [], extra: [], versionChanged: null });
});

test("manifest diff reports a template file added after the manifest was written", async () => {
  const diff = await diffAfter({
    files: TEMPLATE_FIXTURE,
    mutate: (root) => writeFileSync(join(root, "docs", "guide.md"), "# Added later\n", "utf-8")
  });

  assert.deepEqual(diff, { stale: [], missing: ["docs/guide.md"], extra: [], versionChanged: null });
});

test("manifest diff reports a manifest entry whose template file was deleted", async () => {
  const diff = await diffAfter({
    files: TEMPLATE_FIXTURE,
    mutate: (root) => rmSync(join(root, "docs", "assets", "style.css"))
  });

  assert.deepEqual(diff, { stale: [], missing: [], extra: ["docs/assets/style.css"], versionChanged: null });
});

test("manifest diff ignores generatedAt when files and documenterVersion match", async () => {
  const diff = await diffAfter({
    files: TEMPLATE_FIXTURE,
    mutate: async (root) => {
      const path = join(root, MANIFEST_FILENAME);
      const manifest = JSON.parse(readFileSync(path, "utf-8"));
      manifest.generatedAt = "1999-12-31T23:59:59.000Z";
      await writeManifest(path, manifest);
    }
  });

  assert.deepEqual(diff, { stale: [], missing: [], extra: [], versionChanged: null });
});

test("manifest diff reports a documenterVersion that no longer matches the CLI", async () => {
  const diff = await diffAfter({ files: TEMPLATE_FIXTURE, expectedVersion: "9.9.10" });

  assert.deepEqual(diff, {
    stale: [],
    missing: [],
    extra: [],
    versionChanged: { recorded: FIXTURE_VERSION, expected: "9.9.10" }
  });
});

/**
 * Runs `build-manifest.mjs --check --root <tempdir>` against a synthesized template
 * tree whose manifest starts out matching it, after letting `mutate` make that
 * manifest stale. The manifest records the real CLI version because `--root` does
 * not relocate version discovery, so a fixture version would report as changed.
 *
 * @param {{ files: Record<string, string>, mutate?: (root: string) => unknown }} options
 * @returns {Promise<{ code: number | null, out: string, manifestRewritten: boolean }>}
 */
async function runManifestCheck({ files, mutate = () => {} }) {
  const root = mkdtempSync(join(tmpdir(), "documenter-manifest-cli-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, "utf-8");
    }
    const manifestPath = join(root, MANIFEST_FILENAME);
    await writeManifest(manifestPath, await buildManifest(root, await readCliVersion(PACKAGE_ROOT)));

    await mutate(root);
    const beforeCheck = readFileSync(manifestPath);

    const result = spawnSync(process.execPath, [BUILD_MANIFEST, "--check", "--root", root], {
      encoding: "utf-8"
    });

    return {
      code: result.status,
      out: `${result.stdout || ""}${result.stderr || ""}`,
      manifestRewritten: !readFileSync(manifestPath).equals(beforeCheck)
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("build-manifest --check exits 0 without rewriting a manifest that is already current", async () => {
  const r = await runManifestCheck({ files: TEMPLATE_FIXTURE });

  assert.equal(r.code, 0, r.out);
  assert.equal(r.manifestRewritten, false, r.out);
});

test("build-manifest --check fails and names a template file the committed manifest omits", async () => {
  const r = await runManifestCheck({
    files: TEMPLATE_FIXTURE,
    mutate: (root) => writeFileSync(join(root, "docs", "guide.md"), "# Added without regenerating\n", "utf-8")
  });

  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /run 'npm run manifest'/i);
  assert.match(r.out, /docs\/guide\.md/);
});

/**
 * Scaffolds a throwaway target with the real `documenter init` and hands its root
 * to `body`. Check mode returns before `syncPackageJson` runs, so package.json takes
 * no part in the pass/fail decision regardless of what the target carries.
 *
 * @param {(target: string) => unknown} body
 */
async function withInitializedTarget(body) {
  const target = mkdtempSync(join(tmpdir(), "documenter-dogfood-"));
  try {
    const init = spawnSync(process.execPath, [CLI, "init", "--cwd", target], { encoding: "utf-8" });
    assert.equal(init.status, 0, `${init.stdout || ""}${init.stderr || ""}`);

    return await body(target);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

/**
 * Runs `documenter update --check` against a target, reporting whether the run
 * rewrote the target's state file.
 *
 * @param {string} target
 * @returns {{ code: number | null, out: string, stateRewritten: boolean }}
 */
function dogfoodCheck(target) {
  const statePath = join(target, STATE_FILENAME);
  const stateBefore = readFileSync(statePath, "utf-8");

  const result = spawnSync(process.execPath, [CLI, "update", "--check", "--cwd", target], { encoding: "utf-8" });

  return {
    code: result.status,
    out: `${result.stdout || ""}${result.stderr || ""}`,
    stateRewritten: readFileSync(statePath, "utf-8") !== stateBefore
  };
}

test("update --check exits 0 for a current target without rewriting its state file", async () => {
  await withInitializedTarget((target) => {
    const r = dogfoodCheck(target);

    assert.equal(r.code, 0, r.out);
    assert.equal(r.stateRewritten, false, r.out);
  });
});

test("update --check fails and names a managed file missing from the target", async () => {
  await withInitializedTarget((target) => {
    rmSync(join(target, "docs", "index.html"));

    const r = dogfoodCheck(target);

    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /docs\/index\.html/);
  });
});

test("update --check fails and names a stock file the target has not picked up yet", async () => {
  await withInitializedTarget(async (target) => {
    const stockOld = "docs/templates/standard-template.md";
    const priorRevision = "# Standard Template\n\nAn earlier stock revision.\n";
    writeFileSync(join(target, "docs", "templates", "standard-template.md"), priorRevision, "utf-8");
    const state = await readState(target);
    state.managedFiles[stockOld].sha256 = hashBuffer(Buffer.from(priorRevision, "utf-8"), true).sha256;
    await writeState(target, state);

    const r = dogfoodCheck(target);

    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /docs\/templates\/standard-template\.md/);
  });
});

test("update --check fails when the state records a hash the on-disk file no longer has", async () => {
  await withInitializedTarget(async (target) => {
    const state = await readState(target);
    state.managedFiles["docs/assets/style.css"].sha256 = "0".repeat(64);
    await writeState(target, state);

    const r = dogfoodCheck(target);

    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /docs\/assets\/style\.css/);
  });
});

test("update --check exits 0 when a managed file has drifted and nothing else is stale", async () => {
  await withInitializedTarget((target) => {
    writeFileSync(join(target, "docs", "index.md"), "# Locally curated navigation\n", "utf-8");

    const r = dogfoodCheck(target);

    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /run 'documenter update'/i);
  });
});

test("update --check restores nothing and rewrites no state when the target is stale", async () => {
  await withInitializedTarget((target) => {
    const removed = join(target, "docs", "index.html");
    rmSync(removed);

    const r = dogfoodCheck(target);

    assert.match(r.out, /run 'documenter update'/i);
    assert.equal(existsSync(removed), false, r.out);
    assert.equal(r.stateRewritten, false, r.out);
  });
});
