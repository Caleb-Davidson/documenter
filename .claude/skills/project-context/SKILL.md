---
name: project-context
description: The documenter-specific facts the feature-team agents need — package manager and commands, the quality gate, the architecture and dependency rules, the language rules, the area labels, and pointers to the convention docs. This skill is what makes the shared, frozen agent definitions concrete for this repo; each project ships its own version. Loaded automatically by the coder, tester, reviewer, and doc-keeper agents.
---

# Project Context — documenter

This is the per-repo half of the agent team. The agent definitions (coder, tester, reviewer,
doc-keeper) are shared and frozen; they defer every project-specific fact to this file. Keep this
accurate and low-churn — it is the single place documenter's specifics live for the agents.

documenter is a **zero-runtime-dependency Node CLI** (JavaScript `.mjs`, Node 20+) that scaffolds and
maintains a Markdown docs system in target projects. It is `private`/unpublished; distribution is
`git clone` + `npm link`, and it runs straight from source.

## Package manager & commands

- **Package manager:** `npm`.
- **Targeted tests** (coder/tester red→green loop): `node --test test/<file>.test.mjs` (point it at the
  one file you're driving; the suite is plain `node --test` over `test/*.test.mjs`).
- **The quality gate** (lead runs it end-of-phase): `npm run verify` — four checks in parallel: the
  `node --test` suite, `documenter lint` over this repo's own `docs/`, **manifest freshness**
  (`node scripts/build-manifest.mjs --check`), and **dogfood freshness**
  (`node bin/documenter.mjs update --check --cwd .`). The last two make the two manual regeneration
  steps below gate-enforced; both write nothing.
- **Docs lint** (doc-keeper): `npm run docs:lint` (= `documenter lint`).
- Full command list is in `AGENTS.md` → Commands.

## Work tracker

- Issues live on Gitea repo **`mathroze/documenter`**.
- Read: `npm run todo` (`list` / `details <n>` / `claim <n>`).

## Area labels (for issue-triage)

`cli` (the `bin/` entry and `src/` commands and libs), `linter` (the standalone `lib/docs-lint.mjs`),
`template` (the scaffolded docs shell, page templates, and vendored assets under `template/`), `docs`
(this repo's own `docs/`). Multi-label where cross-cutting; a cross-cutting umbrella that fits no area
carries no area label. Canonical taxonomy: this skill + `AGENTS.md` (there is **no ADR** for it).

## Architecture & dependency rules (fixed — don't change unless the plan says so)

- **Zero runtime dependencies.** `bin/` and `src/` import only Node built-ins. Never add a
  `dependencies` block to `package.json`; `devDependencies` are for tooling and vendored browser
  bundles only.
- **Layering:** `bin/documenter.mjs` (arg dispatch) → `src/commands/` (init/update/lint handlers) →
  `src/lib/` (manifest, state, package-json helpers). Preserve this direction.
- **The internal linter `lib/docs-lint.mjs` stays a standalone Node script** that runs with
  `cwd=target` and resolves its own deps from documenter's `node_modules`. Don't refactor it to depend
  on `src/lib/`.
- **The drift model is the core.** `init`/`update` classify each managed file by hash
  (`added`/`current`/`stock-old`/`drifted`); drifted files are skipped, and their prior state entry is
  **preserved verbatim** (never rewritten to the on-disk hash) so a future revert-to-stock stays
  detectable. `template/` is the source of truth for scaffolded output.
- **Hashing is line-ending agnostic for text files** — both the record path (`buildManifest`) and the
  check path (`update`) route through the one shared `hashBuffer()` helper. Don't add a second hashing
  path or compare raw bytes for text (that reintroduces the Windows CRLF false-drift bug). Binary files
  are hashed raw.
- **`template/manifest.json` and target `.documenter.json` are generated** — regenerate, never
  hand-edit. Target `package.json` merges are **additive only** (never overwrite a user's script/dep).
- Canonical detail: `README.md` (the drift model + maintainer workflow), and the architecture docs
  under `docs/` and `template/docs/`.

## Language rules (JavaScript)

- **Plain modern JS (`.mjs`), Node 20+, built-ins only.** Correctness is enforced by the `node --test`
  suite and `documenter lint`.
- **Keep the zero-dependency and additive-merge invariants** (above) — those are the rules agents most
  often slip on here.
- Full rules: `docs/coding-conventions.md` (loaded via `AGENTS.md`).

## Convention docs (the standards the agents enforce)

- **Coding:** `docs/coding-conventions.md`
- **Unit testing:** `docs/unit-testing-conventions.md` (`node --test`, tests under `test/*.test.mjs`)
- **Reviewing:** `docs/reviewing-conventions.md`
- **Documentation style:** `docs/documentation-style-guide.md`

### Docs the doc-keeper reads first

- `docs/documentation-md-contract.md` (the contract `documenter lint` enforces over this repo's `docs/`)
- `docs/documentation-architecture.md`

(Note: `template/docs/documentation-*.md` are the copies **shipped into target projects** — different
files from this repo's own `docs/`. The doc-keeper works on this repo's `docs/`.)

Decision policy: **no ADRs.** Per the repo's "default to no ADR" rule, operational and tooling choices
live in `README.md`, `AGENTS.md`, the `docs/`, and commit history — not a decision log.

## Project-specific workflow steps

- **After ANY change under `template/`, run `npm run manifest`** before completing — a stale manifest
  makes `update` mis-classify drift in user projects. If you bumped a vendored devDep
  (`js-yaml`/`markdown-it`/`dompurify`/`mermaid`), run `npm install` → `npm run sync-vendor` →
  `npm run manifest` (in that order) and commit the refreshed `package-lock.json`, vendor bundles, and
  manifest together.
- **Smoke-test a scaffold change end-to-end** against a throwaway dir before completing:
  `rm -rf /tmp/docu-test && documenter init --cwd /tmp/docu-test && documenter lint --cwd /tmp/docu-test`.
- **Dogfood after every change:** run `documenter update` in the repo root to refresh this repo's own
  `docs/` with the latest platform files, and commit the refreshed `docs/` alongside the change. Never
  hand-copy `template/docs/` into `docs/`. Intentionally-customized files (e.g. `docs/index.md`) show
  as `drifted` and are skipped — expected; don't `--force` without reason.
- **Teardown:** tear down only what you launched locally; the CI preview/docs workflows are Gitea-owned.
