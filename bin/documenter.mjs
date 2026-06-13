#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInit } from "../src/commands/init.mjs";
import { runUpdate } from "../src/commands/update.mjs";
import { runLint } from "../src/commands/lint.mjs";
import { PACKAGE_ROOT } from "../src/lib/paths.mjs";

const SUBCOMMANDS = {
  init: runInit,
  update: runUpdate,
  lint: runLint
};

const [subcommand, ...rest] = process.argv.slice(2);

if (!subcommand || subcommand === "-h" || subcommand === "--help" || subcommand === "help") {
  printHelp();
  process.exit(0);
}

if (subcommand === "-v" || subcommand === "--version") {
  const pkg = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8"));
  console.log(pkg.version);
  process.exit(0);
}

const handler = SUBCOMMANDS[subcommand];
if (!handler) {
  console.error(`documenter: unknown command "${subcommand}"`);
  printHelp();
  process.exit(1);
}

try {
  await handler(rest);
} catch (err) {
  console.error(`documenter: ${err?.message ?? err}`);
  process.exit(1);
}

function printHelp() {
  console.log(`documenter — scaffold and maintain a repo-local markdown docs system

Usage:
  documenter <command> [options]

Commands:
  init      Scaffold docs/ and a docs:lint package.json script in the current project.
            Skips files that already exist (use --force to overwrite).
  update    Refresh platform files (docs/assets, docs/templates, docs/index.html)
            and re-merge package.json. Does not touch user-authored markdown.
  lint      Run the docs linter against docs/ in the current project.

Options:
  --cwd <path>   Target directory (default: process.cwd()).
  --force        For init: overwrite existing files instead of skipping.
  --help, -h     Print this help.
  --version, -v  Print version.

Examples:
  documenter init
  documenter init --cwd ../my-project --force
  documenter update
  documenter lint
`);
}
