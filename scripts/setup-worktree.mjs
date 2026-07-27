#!/usr/bin/env node
// Prepares a freshly created worktree for work. A new worktree is a separate
// checkout with no node_modules of its own, so npm run verify's pre-commit hook
// would otherwise fail there until someone installs manually. Runs automatically
// after EnterWorktree via a PostToolUse hook (see .claude/settings.json). Add more
// one-time setup steps here as they come up.
import { spawn } from "node:child_process";

const steps = [{ name: "install", command: "npm install" }];

/**
 * Runs one setup step to completion, streaming its output directly.
 * @param {{ name: string, command: string }} step The step to run.
 * @returns {Promise<void>} Resolves on success, rejects on a non-zero exit code.
 */
function run(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.command, { shell: true, stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} failed (exit ${code})`));
    });
  });
}

for (const step of steps) {
  console.log(`setup-worktree: running ${step.name}...`);
  await run(step);
}

console.log("setup-worktree: done.");
