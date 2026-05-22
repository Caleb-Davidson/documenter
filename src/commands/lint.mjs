import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { exists } from "../lib/fs.mjs";
import { PACKAGE_ROOT } from "../lib/paths.mjs";

export async function runLint(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      cwd: { type: "string" }
    },
    allowPositionals: false
  });

  const target = resolve(values.cwd ?? process.cwd());
  const docsDir = join(target, "docs");
  if (!(await exists(docsDir))) {
    console.error(`documenter: ${docsDir} not found. Run 'documenter init' first.`);
    process.exit(1);
  }

  const linterScript = join(PACKAGE_ROOT, "lib", "docs-lint.mjs");

  // Spawn the CLI-internal linter with cwd=target so it walks the target's docs/.
  // Module resolution for `js-yaml` happens from the linter's own location,
  // i.e. documenter's node_modules — the target does not need it installed.
  await new Promise((resolveFn) => {
    const child = spawn(process.execPath, [linterScript], {
      stdio: "inherit",
      cwd: target
    });
    child.on("exit", (code) => {
      process.exit(code ?? 1);
      resolveFn();
    });
    child.on("error", (err) => {
      console.error(`documenter: failed to spawn lint: ${err.message}`);
      process.exit(1);
    });
  });
}
