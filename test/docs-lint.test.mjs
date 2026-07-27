import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

// End-to-end tests for the internal docs linter. Each case materializes a small
// docs/ tree in a temp dir and runs lib/docs-lint.mjs against it as a child
// process (cwd=fixture), exactly as `documenter lint` invokes it, then asserts
// on exit code and output. No test framework beyond node:test — the linter and
// its tests stay dependency-light, consistent with the CLI's zero-runtime-dep rule.

const HERE = dirname(fileURLToPath(import.meta.url));
const LINTER = join(HERE, "..", "lib", "docs-lint.mjs");

const TEMPLATE = `---
title: Standard Template
section: Templates
description: Reusable page skeleton.
---

## Purpose

Describe the page purpose.
`;

const INDEX = `---
title: Test Docs
section: Home
description: Test index.
---

## Pages

- [Sample Page](./page.md)
- [Guide](./guide.md)
`;

/**
 * Builds a content page whose single H2 matches the template, embedding the
 * given body under "## Purpose".
 */
function contentPage(title, body) {
  return `---
title: ${title}
section: Guides
description: ${title} description.
template: ./templates/standard-template.md
---

## Purpose

${body}
`;
}

/**
 * Assembles an otherwise-valid docs/ tree (index + template + a sibling guide)
 * with page.md's Purpose section set to the supplied body, so that overall
 * lint pass/fail reflects the internal-link rule under test.
 */
function tree(pageBody) {
  return {
    "docs/index.md": INDEX,
    "docs/templates/standard-template.md": TEMPLATE,
    "docs/guide.md": contentPage("Guide", "Reference guide body."),
    "docs/page.md": contentPage("Sample Page", pageBody)
  };
}

/**
 * Writes the given { relPath: contents } map into a fresh temp dir and runs the
 * linter there. Returns { code, out } where out concatenates stdout+stderr.
 */
function runLint(files) {
  const root = mkdtempSync(join(tmpdir(), "documenter-lint-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, "utf-8");
    }
    const result = spawnSync(process.execPath, [LINTER], { cwd: root, encoding: "utf-8" });
    return { code: result.status, out: `${result.stdout || ""}${result.stderr || ""}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("valid internal link passes", () => {
  const r = runLint(tree("See [the guide](./guide.md) for details."));
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /does not exist/);
});

test("link to a nonexistent file fails and names file, target, and line", () => {
  const r = runLint(tree("See [ADR 0004](./decisions/0004-engine-first-dev-harness.md) for context."));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /does not exist in docs\//);
  // Names the linking file with a line number, the link text, and the target.
  assert.match(r.out, /page\.md:\d+/);
  assert.match(r.out, /\[ADR 0004\]/);
  assert.match(r.out, /decisions\/0004-engine-first-dev-harness\.md/);
});

test("external links (http/https/mailto) are ignored", () => {
  const r = runLint(
    tree("See [example](https://example.com), [insecure](http://example.com), and [mail](mailto:x@example.com).")
  );
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /does not exist/);
});

test("anchor on an existing file resolves the file part and passes", () => {
  const r = runLint(tree("Jump to [guide purpose](./guide.md#purpose)."));
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /does not exist/);
});

test("same-page anchor-only link produces no dangling-link error", () => {
  // A bare "#anchor" link still trips the existing hash-route rule (exit 1),
  // but it must never be misreported as a dangling file reference.
  const r = runLint(tree("Jump to [purpose](#purpose)."));
  assert.doesNotMatch(r.out, /does not exist/);
});

test("dangling link with an anchor is still flagged on its file part", () => {
  const r = runLint(tree("See [gone](./gone.md#section)."));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /gone\.md.*does not exist/);
});

test("dangling non-markdown asset link (e.g. a referenced SVG) is flagged", () => {
  const r = runLint(tree("![Pipeline](./assets/diagrams/missing.svg)"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /assets\/diagrams\/missing\.svg.*does not exist/);
});

test("valid non-markdown asset link passes", () => {
  const files = tree("![Pipeline](./assets/diagrams/pipeline.svg)");
  files["docs/assets/diagrams/pipeline.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
  const r = runLint(files);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /does not exist/);
});

test("dangling links inside fenced code blocks are ignored", () => {
  const r = runLint(tree("Example usage:\n\n```md\n[ADR](./decisions/nonexistent.md)\n```\n"));
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /does not exist/);
});
