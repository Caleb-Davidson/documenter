# documenter

A CLI that scaffolds and maintains a repo-local markdown documentation system in any project. The system is template-driven, statically hostable, lintable, and AI-author friendly.

documenter owns the heavy dependencies (`js-yaml`, `markdown-it`, `dompurify`) and the lint logic. Target projects get just the docs content, the static shell, and a single `docs:lint` script — no transitive devDependencies to manage.

Each managed file is tracked by SHA-256 hash. `documenter update` detects whether a file in your project is unchanged from what we wrote (safe to update) or modified locally (preserved, with `--force` to override).

## Install

```sh
git clone <this-repo> ~/Projects/documenter
cd ~/Projects/documenter
npm install                              # gets js-yaml / markdown-it / dompurify for documenter itself
npm link                                 # exposes the `documenter` command globally
```

Requires Node 20+. To unlink later: `npm unlink -g documenter`.

## Usage

```sh
documenter <command> [options]
```

### `documenter init`

Scaffolds the documentation system into the current directory.

```sh
cd ~/Projects/my-project
documenter init
documenter lint                          # or: npm run docs:lint
```

Creates:

- `docs/` — `index.html` (the static shell), `index.md` (the navigation manifest), the three governing docs (`documentation-architecture.md`, `documentation-md-contract.md`, `documentation-style-guide.md`), and `templates/` (copyable starters).
- `docs/assets/` — runtime JS, CSS, and vendored libraries (markdown-it / dompurify / js-yaml minified bundles).
- `.documenter.json` — state file recording the SHA-256 of every managed file at install time. Used by `update` for drift detection. Commit this.
- `package.json` — adds `"docs:lint": "documenter lint"` if missing. No devDependencies merged.

Existing files are skipped (any pre-existing content stays untouched and goes untracked in state). Use `--force` to overwrite during init.

### `documenter update`

Refresh managed files. Each file is classified by hash:

| Classification | Meaning | Action |
|---|---|---|
| `added` | New file in this CLI version, missing from target | Copy |
| `current` | Target hash matches CLI manifest | Skip |
| `stock-old` | Target hash matches what we last wrote; CLI has newer version | Update |
| `drifted` | Target hash differs from both what we wrote and the new version | Skip with warning |

```sh
documenter update                        # safe: skips drifted files
documenter update --force                # overwrite drifted files too
```

The state file is updated only for files documenter actually wrote. Drifted files keep their previous state record, so reverting to stock is detected on the next run.

### `documenter lint`

Runs the documenter-internal docs linter against `docs/` in the current project. Uses documenter's own `node_modules`, so the target project doesn't need any deps installed.

```sh
documenter lint
```

### Options

| Option | Applies to | Description |
|---|---|---|
| `--cwd <path>` | all | Target a directory other than the current one. |
| `--force` | `init`, `update` | Overwrite files that would normally be preserved. |
| `--help` / `-h` | top-level | Print help. |
| `--version` / `-v` | top-level | Print CLI version. |

## Maintainer workflow (changes to documenter itself)

When you edit anything in `template/` or bump a vendor dependency:

```sh
# 1. (only when bumping vendor deps)
npm install                              # picks up new versions
npm run sync-vendor                      # copies bundles into template/docs/assets/vendor/

# 2. (always after any template change)
npm run manifest                         # rewrites template/manifest.json with fresh hashes

# 3. commit:
git add template/ package.json package-lock.json
git commit -m "..."
```

`template/manifest.json` is the source of truth for what gets copied and how it's hashed. End users see drift detection that's only as accurate as your manifest is current — don't forget to regenerate it.

## What gets scaffolded into a target project

```
my-project/
├── .documenter.json                     # drift-detection state (commit this)
├── docs/
│   ├── index.html
│   ├── index.md                         # navigation manifest — curate this
│   ├── documentation-architecture.md
│   ├── documentation-md-contract.md
│   ├── documentation-style-guide.md
│   ├── assets/
│   │   ├── app.js
│   │   ├── style.css
│   │   └── vendor/{js-yaml,markdown-it,purify}.min.js + versions.json
│   └── templates/
│       ├── contract-template.md
│       ├── decision-record-template.md
│       ├── document-template.md
│       ├── product-requirements-document-template.md
│       ├── standard-template.md
│       ├── system-architecture-template.md
│       └── technical-architecture-template.md
└── package.json                         # gets `"docs:lint": "documenter lint"` added
```

No `node_modules`, no devDependencies added by documenter, no `scripts/` directory.

## Repository layout

```
documenter/
├── bin/documenter.mjs                   # CLI entry (shebang, arg routing)
├── lib/docs-lint.mjs                    # CLI-internal docs linter (uses documenter's node_modules)
├── src/
│   ├── commands/{init,update,lint}.mjs
│   └── lib/{fs,paths,manifest,package-json}.mjs
├── scripts/
│   ├── sync-vendor.mjs                  # maintainer: copy bundles from node_modules → template/
│   └── build-manifest.mjs               # maintainer: regenerate template/manifest.json
└── template/                            # source of truth for everything scaffolded into targets
    ├── manifest.json                    # SHA-256 + size of every file under template/
    └── docs/...
```

## Authoring rules (after scaffold)

See the three governing docs inside your project:

- `docs/documentation-architecture.md` — how the platform works.
- `docs/documentation-md-contract.md` — required structure for new pages.
- `docs/documentation-style-guide.md` — how to write well.
