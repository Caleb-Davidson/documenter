# AGENTS.md

## Project Description

`documenter` is a CLI that scaffolds and maintains a repo-local markdown documentation system in any target project. End users run `documenter init` in their project to drop in a static-hostable docs shell (HTML + CSS + vendored JS), markdown templates, and a navigation manifest; later they run `documenter update` to refresh the platform files. The CLI uses SHA-256 hashes per managed file to distinguish stock files (safe to update) from user-modified ones (preserved by default). All heavy dependencies (`js-yaml`, `markdown-it`, `dompurify`) live in documenter itself — target projects get vendored browser bundles and a single `docs:lint` script, no transitive devDependencies.

## Technologies Used

- **Node.js 20+ (ESM)**: Runtime. `bin/`, `src/`, `lib/`, and `scripts/` are all ESM (`type: "module"`, `.mjs` files). Uses `util.parseArgs`, `fs/promises`, `crypto`, and `child_process` — all built-ins.
- **`js-yaml` (devDep)**: Used by [lib/docs-lint.mjs](lib/docs-lint.mjs) to parse markdown frontmatter when linting target projects. Resolved from documenter's own `node_modules` even when the linter runs with `cwd=target`.
- **`markdown-it`, `dompurify` (devDeps)**: Not imported by any CLI source. Installed only so [scripts/sync-vendor.mjs](scripts/sync-vendor.mjs) can copy their minified browser bundles into `template/docs/assets/vendor/`, where they get shipped into target projects' docs shells.
- **Zero runtime dependencies**: The CLI itself imports only Node built-ins. Keep it that way (see Rules).

## Project Structure

- `bin/documenter.mjs`: CLI entry point with `#!/usr/bin/env node` shebang. Parses the subcommand and dispatches to handlers. Also handles `--help` and `--version`.
- `src/commands/{init,update,lint}.mjs`: One file per subcommand. Each parses its own flags via `util.parseArgs` and is invoked from `bin/documenter.mjs`.
- `src/lib/fs.mjs`: `exists()`, `copyTree()`, and `writeManagedFile()` helpers. `writeManagedFile()` normalizes a text file to LF then re-emits it with the requested EOL; binary files are copied byte-for-byte.
- `src/lib/paths.mjs`: Resolves `PACKAGE_ROOT` and `TEMPLATE_ROOT` from this file's location, so the CLI finds its own `template/` regardless of where the user invokes it from.
- `src/lib/eol.mjs`: `createEolResolver(targetRoot)` → `eolFor(relPath)`. Resolves the line ending documenter should write per target path: `DOCUMENTER_EOL` env → `.gitattributes` (`eol`/`text`) → `core.eol` → `core.autocrlf` → LF. Spawns `git`; falls back to LF if git is missing or the dir isn't a repo.
- `src/lib/manifest.mjs`: Manifest and state-file primitives — `hashBuffer()`, `hashFile()`, `isTextFile()`, `walkFiles()`, `buildManifest()`, `readManifest()`, `writeManifest()`, `readState()`, `writeState()`, `newState()`, `readCliVersion()`. `hashBuffer(buf, isText)` is the single line-ending-agnostic hasher both the record path (`buildManifest`) and the check path (`update`) route through; `hashFile(path, isText)` wraps it. Text files are hashed over LF-normalized content; binary files are hashed raw.
- `src/lib/package-json.mjs`: `REQUIRED_SCRIPTS` (just `"docs:lint": "documenter lint"`), `mergeDocsScaffold()`, `minimalPackageJson()`. Additive merge — never overwrites existing keys in target package.json.
- `lib/docs-lint.mjs`: The docs linter itself. Invoked via `child_process.spawn` with `cwd=target` by [src/commands/lint.mjs](src/commands/lint.mjs). Hardcodes `DOCS_DIR = "docs"` and walks relative paths, so it works against whatever cwd it's spawned in.
- `scripts/sync-vendor.mjs`: Maintainer script. Copies `markdown-it.min.js`, `purify.min.js`, `js-yaml.min.js` from `node_modules/*/dist/` into `template/docs/assets/vendor/`, and writes `versions.json` alongside them.
- `scripts/build-manifest.mjs`: Maintainer script. Walks `template/`, SHA-256 hashes every file, writes `template/manifest.json`.
- `template/`: Source of truth for everything scaffolded into target projects. The whole tree is hashed by the manifest generator.
- `template/manifest.json`: Generated. Maps every relative path under `template/` to `{ sha256, size, isText }`. `sha256`/`size` are over LF-normalized content for text files (so they're stable regardless of how the maintainer's checkout handles EOLs); `isText` is the text/binary decision, consumed by both `init` and `update` so neither re-sniffs. Read by `init` and `update` to decide what to copy and how to classify drift.
- `template/docs/`: The docs shell (`index.html`, `assets/`), three governing docs, seven copyable page templates, and the navigation manifest (`index.md`).

## Commands

```bash
npm install               # Install devDeps (js-yaml, markdown-it, dompurify) for documenter
npm link                  # Expose `documenter` globally for development on this machine
npm unlink -g documenter  # Reverse the above

npm run sync-vendor       # Copy vendor bundles from node_modules into template/docs/assets/vendor/
                          # Run after `npm install` if devDep versions changed.
npm run manifest          # Regenerate template/manifest.json — run this after ANY change to template/

documenter init [--cwd <path>] [--force]   # Scaffold into the current (or given) directory
documenter update [--cwd <path>] [--force] # Refresh managed files, skipping drifted ones
documenter lint [--cwd <path>]             # Run the internal docs linter against the target
documenter --version                       # Print CLI version
documenter --help                          # Print help
```

This project has no test suite, no type checker, and no formatter wired up. Validation is end-to-end: run the CLI against a fresh `/tmp/` directory and verify the resulting tree.

## Architecture Hub

**Important Documentation:**
Before working on a system, read the relevant doc below. These are the source of truth.

- **[README.md](README.md)**: The canonical architecture and maintainer reference for this repo. Explains the drift-detection model, the four file classifications (`added`/`current`/`stock-old`/`drifted`), the maintainer workflow for changing `template/` or bumping vendor deps, and the target-project layout produced by `init`. Read this before changing anything in `src/commands/`, `src/lib/manifest.mjs`, or the scripts.
- **[template/docs/documentation-architecture.md](template/docs/documentation-architecture.md)**: Describes the docs platform that gets shipped into target projects — shell runtime, manifest-driven navigation, sanitized rendering. Read before changing `template/docs/index.html`, `template/docs/assets/app.js`, or the docs-shell behavior.
- **[template/docs/documentation-md-contract.md](template/docs/documentation-md-contract.md)**: Required structure for any markdown page in a target project's `docs/`. Read before changing what the linter enforces in [lib/docs-lint.mjs](lib/docs-lint.mjs) or before editing the page templates under `template/docs/templates/`.
- **[template/docs/documentation-style-guide.md](template/docs/documentation-style-guide.md)**: Writing rules for the docs shipped into target projects. Read before editing seed content in `template/docs/`.

## CLI Structure

The runtime flow for any documenter command:

1. **`bin/documenter.mjs`** — Receives `process.argv`. Picks subcommand from `argv[2]`. Looks up the handler in the `SUBCOMMANDS` map and invokes it with the remaining args.
2. **Subcommand handler** (in `src/commands/`) — Parses its own flags. Loads `template/manifest.json` if needed via `readManifest()`. Reads/writes the target's `.documenter.json` via `readState()`/`writeState()`.
3. **For `init` and `update`** — Walk the manifest, classify each file by hash (`current` / `expected` from state / `newHash` from manifest), copy or skip, update state. Hashes are compared line-ending-agnostically via `hashBuffer()`, and files are written with the target repo's preferred EOL via `createEolResolver()`.
4. **For `lint`** — Spawn `lib/docs-lint.mjs` as a child process with `cwd=target`. `js-yaml` resolves from documenter's `node_modules` because Node resolution walks up from the script's own location, not cwd.

State semantics that matter:

- **`.documenter.json` (target)**: Records the hash of each managed file *as documenter last wrote it*. Used as `expected` during drift classification.
- **When drift is detected and skipped**: do **not** rewrite the state entry to the on-disk hash. Keep the prior entry so a future revert-to-stock is still detectable. See [src/commands/update.mjs:111](src/commands/update.mjs:111).
- **When `init` skips an existing file**: do **not** record a state entry for it. Documenter didn't write it, so it shouldn't claim ownership. See [src/commands/init.mjs:53](src/commands/init.mjs:53).

## Rules

- **After ANY change to `template/`, run `npm run manifest`.** A stale manifest causes `update` to mis-classify drift in user projects. There is no automatic regeneration — it's manual and load-bearing.
- **After bumping `js-yaml`, `markdown-it`, or `dompurify` in `package.json`**: `npm install` → `npm run sync-vendor` → `npm run manifest`. Commit all three: updated `package-lock.json`, refreshed `template/docs/assets/vendor/*`, and the new `template/manifest.json`.
- **Keep zero runtime dependencies.** `bin/` and `src/` import only Node built-ins. Do not add a `dependencies` block to `package.json`. `devDependencies` are for tooling and vendored browser bundles only.
- **Do not hand-edit `template/manifest.json`** — it's generated by `scripts/build-manifest.mjs`. Edit `template/` content, then regenerate.
- **Do not hand-edit `.documenter.json` in target projects** — it's generated by `init` and `update`.
- **The internal linter at `lib/docs-lint.mjs` must remain a standalone Node script** that runs with `cwd=target` and resolves `js-yaml` from documenter's own `node_modules`. Don't refactor it to depend on `src/lib/` helpers — keep it self-contained.
- **State-update semantics on drift**: when classification is `drifted` and we skip, preserve the prior state entry verbatim. When classification is `forced` and we overwrite, update state to the new hash. See the test scenarios in README §Verified end-to-end.
- **`additive merge only` for target `package.json`.** [src/lib/package-json.mjs](src/lib/package-json.mjs) must never overwrite an existing script or dependency in a user's package.json.
- **All template files are POSIX-normalized in the manifest** (forward slashes in keys). [src/lib/manifest.mjs](src/lib/manifest.mjs:101) handles this via `toPosix()`. Don't introduce platform-specific path keys.
- **Hashing is line-ending agnostic for text files.** Both the record path (`buildManifest`) and the check path (`update`) must route through the one shared `hashBuffer()` helper so they can never diverge. Don't add a second hashing path or compare raw bytes for text — that reintroduces the Windows false-drift bug (CRLF on disk vs LF manifest). Binary files (per `isTextFile()`) are hashed raw — never normalize them.

## Agent Workflow

When making changes:

1. Read this `AGENTS.md`.
2. Read [README.md](README.md) for the drift model and maintainer workflow.
3. Read the architecture doc relevant to what you're touching (e.g., the docs contract before editing the linter).
4. Inspect the existing implementation before editing.
5. If you change anything under `template/`, run `npm run manifest` before reporting completion.
6. If you bump a vendor dep, run `sync-vendor` and `manifest` in that order.
7. Smoke-test end-to-end against a fresh `/tmp/` directory:
   ```bash
   rm -rf /tmp/docu-test && documenter init --cwd /tmp/docu-test && documenter lint --cwd /tmp/docu-test
   ```
8. Update README.md when the drift model, command surface, or maintainer workflow changes.

## Notes for Future Agents

- **`CLAUDE.md` is a one-line include of `AGENTS.md`** (`@AGENTS.md`). All agent-facing instructions go in this file.
- **`template/manifest.json` and target `.documenter.json` are generated files.** Treat as build artifacts: regenerate them, don't edit them.
- **`template/docs/assets/vendor/*.min.js` and `versions.json` are committed.** This is deliberate — it gives the manifest deterministic hashes. Refresh via `npm run sync-vendor`, not by hand.
- **The CLI is intended for `npm link`-based local install on developer machines.** It is private (`"private": true` in `package.json`) and not published to a registry. Distribution is `git clone` + `npm link`.
- **There is no test suite.** Validation is the smoke test in §Agent Workflow. If you add automated tests, place them under a new `test/` directory and add an `npm test` script.
- **The `example-app/` directory does not exist in this repo.** It was a one-time example used during initial extraction and has been removed. Don't reintroduce it.
- **`lib/docs-lint.mjs` was extracted from a target project** and still has minor remnants of that context (JSDoc typedefs, etc.) — that's expected. Its `checkVendorVersions` function was removed when it moved here; don't reintroduce it (manifest hashes cover integrity now).
