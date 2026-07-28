# AGENTS.md

@docs/coding-conventions.md
@docs/unit-testing-conventions.md
@docs/reviewing-conventions.md
@docs/documentation-style-guide.md

## Project Description

`documenter` is a CLI that scaffolds and maintains a repo-local markdown documentation system in any target project. End users run `documenter init` in their project to drop in a static-hostable docs shell (HTML + CSS + vendored JS), markdown templates, and a navigation manifest; later they run `documenter update` to refresh the platform files. The CLI uses SHA-256 hashes per managed file to distinguish stock files (safe to update) from user-modified ones (preserved by default). All heavy dependencies (`js-yaml`, `markdown-it`, `dompurify`, `mermaid`) live in documenter itself — target projects get vendored browser bundles and a single `docs:lint` script, no transitive devDependencies.

> **Before you change anything:** run `npm run verify` (a husky pre-commit hook enforces it) and read the **Rules** and **Agent Workflow** below. Work is tracked as Gitea issues (`npm run todo`), implementation happens in a git worktree off protected `main`, and non-trivial features go through the feature team.

## Technologies Used

- **Node.js 20+ (ESM)**: Runtime. `bin/`, `src/`, `lib/`, and `scripts/` are all ESM (`type: "module"`, `.mjs` files). Uses `util.parseArgs`, `fs/promises`, `crypto`, and `child_process` — all built-ins.
- **`js-yaml` (devDep)**: Used by [lib/docs-lint.mjs](lib/docs-lint.mjs) to parse markdown frontmatter when linting target projects. Resolved from documenter's own `node_modules` even when the linter runs with `cwd=target`.
- **`markdown-it`, `dompurify`, `mermaid` (devDeps)**: Not imported by any CLI source. Installed only so [scripts/sync-vendor.mjs](scripts/sync-vendor.mjs) can copy their minified browser bundles into `template/docs/assets/vendor/`, where they get shipped into target projects' docs shells.
- **Zero runtime dependencies**: The CLI itself imports only Node built-ins. Keep it that way (see Rules).
- **`node:test` + `node:assert` (built-in)**: The test suite ([test/docs-lint.test.mjs](test/docs-lint.test.mjs)) runs on Node's built-in test runner via `npm test` — no third-party framework, consistent with the zero-dependency rule.
- **husky (devDep)**: Runs the `npm run verify` gate as a pre-commit hook, so a green local run matches the pre-commit and CI.

## Project Structure

- `bin/documenter.mjs`: CLI entry point with `#!/usr/bin/env node` shebang. Parses the subcommand and dispatches to handlers. Also handles `--help` and `--version`.
- `src/commands/{init,update,lint}.mjs`: One file per subcommand. Each parses its own flags via `util.parseArgs` and is invoked from `bin/documenter.mjs`.
- `src/lib/fs.mjs`: `exists()`, `copyTree()`, and `writeManagedFile()` helpers. `writeManagedFile()` normalizes a text file to LF then re-emits it with the requested EOL; binary files are copied byte-for-byte.
- `src/lib/paths.mjs`: Resolves `PACKAGE_ROOT` and `TEMPLATE_ROOT` from this file's location, so the CLI finds its own `template/` regardless of where the user invokes it from.
- `src/lib/eol.mjs`: `createEolResolver(targetRoot)` → `eolFor(relPath)`. Resolves the line ending documenter should write per target path: `DOCUMENTER_EOL` env → `.gitattributes` (`eol`/`text`) → `core.eol` → `core.autocrlf` → LF. Spawns `git`; falls back to LF if git is missing or the dir isn't a repo.
- `src/lib/manifest.mjs`: Manifest and state-file primitives — `hashBuffer()`, `hashFile()`, `isTextFile()`, `walkFiles()`, `buildManifest()`, `readManifest()`, `writeManifest()`, `readState()`, `writeState()`, `newState()`, `readCliVersion()`. `hashBuffer(buf, isText)` is the single line-ending-agnostic hasher both the record path (`buildManifest`) and the check path (`update`) route through; `hashFile(path, isText)` wraps it. Text files are hashed over LF-normalized content; binary files are hashed raw.
- `src/lib/package-json.mjs`: `REQUIRED_SCRIPTS` (just `"docs:lint": "documenter lint"`), `mergeDocsScaffold()`, `minimalPackageJson()`. Additive merge — never overwrites existing keys in target package.json.
- `lib/docs-lint.mjs`: The docs linter itself. Invoked via `child_process.spawn` with `cwd=target` by [src/commands/lint.mjs](src/commands/lint.mjs). Hardcodes `DOCS_DIR = "docs"` and walks relative paths, so it works against whatever cwd it's spawned in.
- `scripts/sync-vendor.mjs`: Maintainer script. Copies `markdown-it.min.js`, `purify.min.js`, `js-yaml.min.js`, `mermaid.min.js` from `node_modules/*/dist/` into `template/docs/assets/vendor/`, and writes `versions.json` alongside them.
- `scripts/build-manifest.mjs`: Maintainer script. Walks `template/`, SHA-256 hashes every file, writes `template/manifest.json`.
- `scripts/verify.mjs`: The aggregate quality-gate runner behind `npm run verify` and the pre-commit hook — runs the `node --test` suite and `documenter lint` in parallel.
- `scripts/todo.mjs`: The work-tracker CLI behind `npm run todo` (`list` / `details <n>` / `claim <n>`) — lists the open Gitea issues on `mathroze/documenter` grouped In Progress / Next / Blocked / Someday, shows one in full, or claims one. Work is tracked as Gitea issues, not an in-repo file.
- `scripts/setup-worktree.mjs`: One-time worktree setup (currently `npm install`); runs automatically via a post-`EnterWorktree` hook (see `.claude/settings.json`).
- `docs/`: This repo's own documenter-managed docs — the platform governing docs plus the engineering conventions (`coding-conventions.md`, `unit-testing-conventions.md`, `reviewing-conventions.md`) the feature team enforces.
- `.claude/`: The agent workflow — `settings.json` (the worktree-setup hook), `skills/{issue-triage,feature-team}`, and `agents/{coder,tester,reviewer,doc-keeper}.md`.
- `.gitea/workflows/`: Gitea Actions — `pr.yml` (the required `verify` check), `issue-label-cleanup.yml`, and the docs-publishing set (`publish-docs.yml`, `preview-docs.yml`, `cleanup-docs.yml`).
- `template/`: Source of truth for everything scaffolded into target projects. The whole tree is hashed by the manifest generator.
- `template/manifest.json`: Generated. Maps every relative path under `template/` to `{ sha256, size, isText }`. `sha256`/`size` are over LF-normalized content for text files (so they're stable regardless of how the maintainer's checkout handles EOLs); `isText` is the text/binary decision, consumed by both `init` and `update` so neither re-sniffs. Read by `init` and `update` to decide what to copy and how to classify drift.
- `template/docs/`: The docs shell (`index.html`, `assets/`), three governing docs, seven copyable page templates plus a reusable `diagram-template.svg`, and the navigation manifest (`index.md`).

## Commands

```bash
npm install               # Install devDeps (js-yaml, markdown-it, dompurify, mermaid) for documenter
npm link                  # Expose `documenter` globally for development on this machine
npm unlink -g documenter  # Reverse the above

npm run sync-vendor       # Copy vendor bundles from node_modules into template/docs/assets/vendor/
                          # Run after `npm install` if devDep versions changed.
npm run manifest          # Regenerate template/manifest.json — run this after ANY change to template/

npm run verify            # The gate: node --test suite + documenter lint (run in parallel)
npm test                  # Run the node:test suite only
npm run docs:lint         # Lint this repo's own docs/ (documenter lint)
npm run todo              # Work tracker: list open issues (also `todo details <n>` and `todo claim <n>`)
npm run setup:worktree    # One-time worktree setup (npm install); runs automatically via a post-EnterWorktree hook

documenter init [--cwd <path>] [--force]   # Scaffold into the current (or given) directory
documenter update [--cwd <path>] [--force] # Refresh managed files, skipping drifted ones
documenter lint [--cwd <path>]             # Run the internal docs linter against the target
documenter --version                       # Print CLI version
documenter --help                          # Print help
```

The gate is `npm run verify` (the `node --test` suite plus `documenter lint`); there is no type checker or formatter. Beyond the gate, validate a scaffold change end-to-end by running the CLI against a fresh throwaway directory and inspecting the resulting tree.

## Architecture Hub

**Important Documentation:**
Before working on a system, read the relevant doc below. These are the source of truth.

- **[README.md](README.md)**: The canonical architecture and maintainer reference for this repo. Explains the drift-detection model, the four file classifications (`added`/`current`/`stock-old`/`drifted`), the maintainer workflow for changing `template/` or bumping vendor deps, and the target-project layout produced by `init`. Read this before changing anything in `src/commands/`, `src/lib/manifest.mjs`, or the scripts.
- **[template/docs/documentation-architecture.md](template/docs/documentation-architecture.md)**: Describes the docs platform that gets shipped into target projects — shell runtime, manifest-driven navigation, sanitized rendering. Read before changing `template/docs/index.html`, `template/docs/assets/app.js`, or the docs-shell behavior.
- **[template/docs/documentation-md-contract.md](template/docs/documentation-md-contract.md)**: Required structure for any markdown page in a target project's `docs/`. Read before changing what the linter enforces in [lib/docs-lint.mjs](lib/docs-lint.mjs) or before editing the page templates under `template/docs/templates/`.
- **[template/docs/documentation-style-guide.md](template/docs/documentation-style-guide.md)**: Writing rules for the docs shipped into target projects. Read before editing seed content in `template/docs/`.
- **[docs/coding-conventions.md](docs/coding-conventions.md)**, **[docs/unit-testing-conventions.md](docs/unit-testing-conventions.md)**, **[docs/reviewing-conventions.md](docs/reviewing-conventions.md)**: The engineering conventions the feature team enforces (also `@`-included at the top of this file). Read before writing or reviewing CLI code and tests.

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

## Build Targets

- **The CLI itself** is the deliverable — there is no bundling or compile step. It is `private` and unpublished; distribution is `git clone` + `npm link`, and it runs straight from source on Node 20+.
- **The scaffolded output** is what documenter produces in a target project: the docs shell, page templates, and vendored bundles under the target's `docs/`, plus a `.documenter.json` state file and a `docs:lint` script in `package.json`. `template/` is the source of truth for that output.

## Rules

- **After ANY change to `template/`, run `npm run manifest`.** A stale manifest causes `update` to mis-classify drift in user projects. There is no automatic regeneration — it's manual and load-bearing.
- **After bumping `js-yaml`, `markdown-it`, `dompurify`, or `mermaid` in `package.json`**: `npm install` → `npm run sync-vendor` → `npm run manifest`. Commit all three: updated `package-lock.json`, refreshed `template/docs/assets/vendor/*`, and the new `template/manifest.json`.
- **Keep zero runtime dependencies.** `bin/` and `src/` import only Node built-ins. Do not add a `dependencies` block to `package.json`. `devDependencies` are for tooling and vendored browser bundles only.
- **Do not hand-edit `template/manifest.json`** — it's generated by `scripts/build-manifest.mjs`. Edit `template/` content, then regenerate.
- **Do not hand-edit `.documenter.json` in target projects** — it's generated by `init` and `update`.
- **The internal linter at `lib/docs-lint.mjs` must remain a standalone Node script** that runs with `cwd=target` and resolves `js-yaml` from documenter's own `node_modules`. Don't refactor it to depend on `src/lib/` helpers — keep it self-contained.
- **State-update semantics on drift**: when classification is `drifted` and we skip, preserve the prior state entry verbatim. When classification is `forced` and we overwrite, update state to the new hash. See the test scenarios in README §Verified end-to-end.
- **`additive merge only` for target `package.json`.** [src/lib/package-json.mjs](src/lib/package-json.mjs) must never overwrite an existing script or dependency in a user's package.json.
- **All template files are POSIX-normalized in the manifest** (forward slashes in keys). [src/lib/manifest.mjs](src/lib/manifest.mjs:101) handles this via `toPosix()`. Don't introduce platform-specific path keys.
- **Hashing is line-ending agnostic for text files.** Both the record path (`buildManifest`) and the check path (`update`) must route through the one shared `hashBuffer()` helper so they can never diverge. Don't add a second hashing path or compare raw bytes for text — that reintroduces the Windows false-drift bug (CRLF on disk vs LF manifest). Binary files (per `isTextFile()`) are hashed raw — never normalize them.
- **Dogfood after every change.** This repo is itself documenter-managed (it has its own `docs/` and `.documenter.json`). Whenever you finish implementing a change, run `documenter update` in the repo root to refresh the in-repo `docs/` with the latest platform files, then commit the refreshed `docs/` alongside your change. Never hand-copy `template/docs/` files into `docs/` — always go through the CLI so the drift model is exercised end-to-end. Files the repo has intentionally customized (e.g. `docs/index.md`) will show as `drifted` and be skipped — that's expected; don't `--force` them without reason.
- **Everything points at the gate.** Run `npm run verify` before completing any change; the husky pre-commit hook and the Gitea `pr.yml` check run the same gate, so a green local run matches CI. Code and tests follow the conventions in `docs/` (see the `@`-includes above); those are non-negotiable defaults and only the user grants an exception.
- **Route non-trivial implementation through the feature team.** See [.claude/skills/feature-team/SKILL.md](.claude/skills/feature-team/SKILL.md). Skip the team only when **all four** hold: the change touches a single file, fewer than 20 lines change, the logic is straightforward, and at most one doc update is needed. Otherwise use the team.
- **Commit with the `conventional-commit` skill** (Conventional Commits format). The repo is **LF-only**, enforced by `.gitattributes` — keep it that way.

## Agent Workflow

@AGENT-WORKFLOW.md

The shared lifecycle above (claim → worktree → feature-team-or-solo → gate → PR → cleanup) is
maintained centrally via skillful and reads this file's `## Commands` for the concrete tracker and
gate commands, the Architecture Hub / Rules for the drift model and layering to preserve, and
[README.md](README.md) for the drift model and maintainer workflow. `EnterWorktree` fires a hook that
runs `npm run setup:worktree` (`npm install`) so the fresh checkout can pass the gate. History is
linear and PRs merge by fast-forward, so if a PR reports conflicts, `git rebase` onto the latest `main`
(never merge `main` into the branch), re-run `npm run verify`, and force-push with `--force-with-lease`.

### Project-specific workflow steps

These are load-bearing for documenter and run **in addition to** the shared steps, before the gate:

- **If you changed anything under `template/`, run `npm run manifest`.** A stale manifest makes
  `update` mis-classify drift in user projects. If you bumped a vendored devDep, run `npm install` →
  `npm run sync-vendor` → `npm run manifest` (in that order) and commit the refreshed
  `package-lock.json`, vendor bundles, and manifest together.
- **Smoke-test a scaffold change end-to-end** against a fresh throwaway directory:
  ```bash
  rm -rf /tmp/docu-test && documenter init --cwd /tmp/docu-test && documenter lint --cwd /tmp/docu-test
  ```
- **Dogfood** after every change: run `documenter update` in the repo root to refresh the in-repo
  `docs/`, and commit the refreshed files alongside your change (never hand-copy `template/docs/`).
- **Teardown:** tear down only what you launched locally; the CI preview/docs workflows are Gitea-owned.

## Notes for Future Agents

- **`CLAUDE.md` is a one-line include of `AGENTS.md`** (`@AGENTS.md`). All agent-facing instructions go in this file.
- **`template/manifest.json` and target `.documenter.json` are generated files.** Treat as build artifacts: regenerate them, don't edit them.
- **`template/docs/assets/vendor/*.min.js` and `versions.json` are committed.** This is deliberate — it gives the manifest deterministic hashes. Refresh via `npm run sync-vendor`, not by hand.
- **The CLI is intended for `npm link`-based local install on developer machines.** It is private (`"private": true` in `package.json`) and not published to a registry. Distribution is `git clone` + `npm link`.
- **The gate is `npm run verify`** — the `node:test` suite (`test/*.test.mjs`) plus `documenter lint` over this repo's own `docs/`. Add new tests under `test/`; there is no type checker or formatter to satisfy.
- **Keep this section low-churn.** It is for stable, high-value gotchas — not project or implementation status, which lives in the code, the docs, and git history and would go stale here while still being trusted.
- **When the user pushes back on a recommendation, re-reason and state your honest view** — don't reflexively concede. Update only what the correction actually invalidates, then give your real opinion and leave the decision with the user.
- **The `example-app/` directory does not exist in this repo.** It was a one-time example used during initial extraction and has been removed. Don't reintroduce it.
- **`lib/docs-lint.mjs` was extracted from a target project** and still has minor remnants of that context (JSDoc typedefs, etc.) — that's expected. Its `checkVendorVersions` function was removed when it moved here; don't reintroduce it (manifest hashes cover integrity now).
