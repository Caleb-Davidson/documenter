#!/usr/bin/env node
// The quality gate. Runs every available check in parallel and exits non-zero if
// any fails, so a green local run matches the pre-commit hook. `test` runs the
// node:test suite over test/*.test.mjs; `docs:lint` runs the internal documenter
// linter over this repo's own docs/. Add checks here as the project grows a
// typecheck, lint, or format step.
//
// `manifest` and `dogfood` guard the two generated artifacts the workflow expects a
// maintainer to refresh by hand. Both go through a local `node` invocation rather than
// the `documenter` bin, which is only on PATH when a machine has run `npm link`.
import { spawn } from "node:child_process";

const checks = [
  { name: "test", command: "npm test" },
  { name: "docs:lint", command: "npm run docs:lint" },
  { name: "manifest", command: "node scripts/build-manifest.mjs --check" },
  { name: "dogfood", command: "node bin/documenter.mjs update --check --cwd ." },
];

/**
 * Runs one check to completion, capturing its combined output and exit code.
 * @param {{ name: string, command: string }} check The check to run.
 * @returns {Promise<{ name: string, command: string, code: number, output: string }>} The result.
 */
function run(check) {
  return new Promise((resolve) => {
    const child = spawn(check.command, { shell: true });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ ...check, code: code ?? 1, output }));
  });
}

const start = Date.now();
const results = await Promise.all(checks.map(run));
const failed = results.filter((result) => result.code !== 0);

for (const result of results) {
  console.log(`${result.code === 0 ? "PASS" : "FAIL"}  ${result.name}`);
}

const seconds = ((Date.now() - start) / 1000).toFixed(1);

if (failed.length > 0) {
  for (const result of failed) {
    console.log(`\n----- ${result.name} -----\n${result.output.trim()}`);
  }
  console.error(`\nverify: ${failed.length} of ${results.length} checks failed in ${seconds}s.`);
  process.exit(1);
}

console.log(`\nverify: all ${results.length} checks passed in ${seconds}s.`);
