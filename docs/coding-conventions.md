---
title: Coding Conventions
section: Conventions
description: How code is written here — naming, structure, comments, dependencies, and fitness for purpose across the documenter CLI.
template: ./templates/standard-template.md
---

## Purpose

Defines how JavaScript is written across the documenter CLI: naming, structure, comments, error
handling, and what "good enough, not over-built" means. It keeps the code self-documenting, trusting
of its own boundaries, dependency-free, and no larger than the problem — so it reads clearly and
everyone, human or agent, writes it the same way.

## Scope

### In scope

- JavaScript (ESM, `.mjs`) style, structure, comments, error handling, and code quality across
  `bin/`, `src/`, `lib/`, and `scripts/`.

### Out of scope

- Architecture, the module layering, and the zero-runtime-dependency rule — see `AGENTS.md` and
  `README.md`, which are canonical for how the CLI is structured.
- Test authoring — see [Unit Testing Conventions](./unit-testing-conventions.md).
- The review process — see [Code Review Conventions](./reviewing-conventions.md).

## Philosophy

- **Code is self-documenting.** Names and structure carry the meaning; comments add the context names
  cannot.
- **DRY, and one responsibility at every level** — function, file, module, system.
- **Fit for purpose (YAGNI).** Build for what is needed now: no speculative indirection, no wrappers
  for their own sake, no defensive code for states that cannot occur.
- **Trust the boundary.** Validate untrusted input where it enters (CLI args, files on disk, spawned
  processes) and fail fast there; the interior then trusts what the boundary guaranteed.
- **Immutability by default.** Data flows as new values; nothing mutates in place without cause.
- **Depend on nothing.** The CLI imports only Node built-ins; every dependency avoided is a dependency
  target projects never inherit.

## Core Rules

| Rule                        | Required practice                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-documenting names      | Descriptive where it clarifies, terse where context makes it obvious — never cryptic. Functions are verbs; booleans are predicates (`is`/`has`); values are nouns. |
| DRY + single responsibility | One reason to change per function, file, and module. Extract shared logic; never duplicate it.                                                           |
| File size                   | ~200 lines is the soft cap; over it usually signals more than one responsibility — split it.                                                             |
| Zero runtime dependencies   | `bin/` and `src/` import only Node built-ins; never add a `dependencies` block. `devDependencies` are for tooling and the vendored browser bundles only. |
| Standalone linter           | `lib/docs-lint.mjs` stays self-contained — it runs with `cwd=target` and must not import `src/lib/` helpers.                                             |
| Immutability                | Don't mutate inputs or shared state without cause; prefer returning new values and passing dependencies explicitly.                                      |
| Model absence as a value    | Where a domain value may be absent, return a neutral value (a null-object) rather than leaking `null`/`undefined` through call sites.                     |
| Fail fast at the boundary   | Throw a clear, specific `Error` at a real boundary violation; trust the boundary everywhere inside.                                                      |
| Public JSDoc                | Every exported function carries JSDoc with accurate `@param`/`@returns`; prefix intentionally-unused params with `_`.                                     |

## Required Practices

### Practice: Write comments that add context, not narration

**Requirement:** Comments explain the _why_ — context, intent, a non-obvious decision — and never
restate a name or what the code plainly does. Keep them short and present-tense: they describe the
current state as a living document, not a changelog of what changed or used to be. Use inline comments
sparingly, only where the code is non-obvious or the reason for a decision is not visible in the code.

For `@param` and `@returns` tags, accuracy is the bar: plain, mechanical descriptions that correctly
describe the parameter are acceptable. Only a tag that is inaccurate, stale, or pure filler fails.

An unnecessary comment is worse than no comment — it adds noise, misleads future readers, and must be
maintained alongside the code it describes. When in doubt, omit.

**Reason:** JSDoc presence is expected on exports, but only authored context earns a comment its space;
restatement, change-history, and noise rot and then mislead.

**Example:**

```js
// Text files are hashed over LF-normalized content so CRLF-vs-LF on disk never reads as drift;
// binary files are hashed raw. Both the record and check paths route through here so they can't diverge.
return createHash("sha256").update(isText ? toLf(buf) : buf).digest("hex");
```

### Practice: Trust the boundary; fail fast at it

**Requirement:** Validate and parse untrusted input at the boundary — the CLI argument parse, reading
a manifest or state file, a spawned `git` result — and have that layer throw a clear, specific error on
violation. Inside the boundary, trust the data: interior helpers do not re-validate what the boundary
already guaranteed.

**Reason:** We own the whole lifecycle and know what data can occur, so interior defensive code guards
states that cannot happen. It also bounds the tests: inputs the boundary rejects are not valid unit-test
cases (see [Unit Testing Conventions](./unit-testing-conventions.md)).

### Practice: Prefer immutability and predictable data flow

**Requirement:** Return new values instead of mutating inputs or shared state where practical, and pass
dependencies (a resolver, a spawn function) explicitly rather than reaching for ambient state.

**Reason:** Predictable data flow is what keeps `init`/`update` classification reproducible — the same
tree and manifest always classify the same way.

### Practice: Document every public export with JSDoc

**Requirement:** Every exported function carries a JSDoc block whose summary states intent and whose
`@param`/`@returns` tags accurately describe the shape. Match the existing style in `src/lib/`.

**Reason:** The CLI has no type checker, so JSDoc is the primary contract for a function's inputs and
outputs; an accurate block is what lets a reader use an export without reading its body.

## Prohibited Practices

| Prohibited practice                                                                  | Why it is prohibited                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A runtime `dependencies` entry, or importing a non-built-in from `bin/`/`src/`       | Breaks the zero-dependency guarantee target projects rely on.                                                                    |
| Defensive code for impossible states                                                 | The boundary already validated; the guard is dead code.                                                                          |
| Speculative generality — extra layers, wrappers, options "for later"                 | Not needed now; indirection without payoff.                                                                                       |
| Comments that restate a name or obvious behavior                                     | Noise; a comment must add context.                                                                                               |
| Changelog comments (what changed or used to be)                                      | Comments describe the present; git holds the history.                                                                            |
| Denying a treatment the reader never expected (`not special-cased`, `rather than X`) | A changelog comment in disguise: it reads as present-tense but exists only because the code used to do X. Describe the present. |
| Cataloguing every decision made around the code (a justification log)                | The reader needs the one non-obvious _why_, not a list of every choice; state what it is and stop.                              |
| Stale comments — a comment that no longer matches the code it describes              | A stale comment actively misleads; update or remove it in the same change that makes it false.                                  |
| A second hashing path, or comparing raw bytes for text files                         | Reintroduces the Windows CRLF false-drift bug; the one shared `hashBuffer()` is the only path.                                   |
| A file carrying unrelated responsibilities                                           | Violates SRP; split it.                                                                                                          |

## Patterns

### Pattern: Fail fast at the boundary

**Use when:** untrusted input crosses into the CLI — argv, a file read off disk, a spawned process.

**Pattern:**

```js
// The boundary parses and validates; on a violation it throws a specific Error. Interior callers
// then trust the parsed value and never re-check it.
export function readManifest(root) {
  const raw = readFileSync(join(root, "template", "manifest.json"), "utf-8");
  return JSON.parse(raw); // a malformed manifest is a real, loud failure at the boundary, not a silent skip
}
```

**Notes:**

- Validation belongs at a real boundary and is owned there, never re-checked inside. Interior helpers
  take already-parsed values and need no guard.

### Pattern: One shared line-ending-agnostic hasher

**Use when:** hashing a file's content on both the record path (`buildManifest`) and the check path (`update`).

**Pattern:**

```js
// Single source of truth: text is hashed over LF-normalized content, binary raw. Both paths call this,
// so a text file re-saved with CRLF never mis-classifies as drift.
export function hashBuffer(buf, isText) {
  return createHash("sha256").update(isText ? normalizeToLf(buf) : buf).digest("hex");
}
```

**Notes:**

- Never add a second hashing path — the record and check paths must be provably identical.
- `isTextFile()` owns the text/binary decision; binary files are never normalized.

### Pattern: Null-object over null

**Use when:** a value may be "absent" and every consumer would otherwise need a null-check.

**Pattern:**

```js
// A file documenter never wrote has no recorded state; represent "no entry" as a neutral value
// consumers can treat uniformly, not a null that spreads guards through every call site.
const previous = state.files[relPath] ?? { sha256: "", size: 0 };
```

## Examples

### Strong example

```js
/**
 * The line ending documenter should write for a target path.
 * @param {string} relPath Target-relative path being written.
 * @returns {"lf" | "crlf"} The resolved line ending.
 */
export function eolFor(relPath) {
  const override = process.env.DOCUMENTER_EOL;
  if (override === "lf" || override === "crlf") return override; // explicit override wins
  if (gitAttribute(relPath) === "crlf") return "crlf";
  return "lf";
}
```

**Why this works:** a descriptive name, an accurate JSDoc block, early returns instead of nesting, one
context comment, and no mutation.

### Weak example

```js
// gets the eol
export function getEol(p) {
  let result = "lf";
  if (p !== null && p !== undefined) {
    if (process.env.DOCUMENTER_EOL) {
      result = process.env.DOCUMENTER_EOL;
    }
  }
  return result;
}
```

**Why this should be changed:** a comment that restates the name, a defensive null-check for a path the
caller always supplies, a mutable accumulator instead of early returns, a cryptic parameter name, no
JSDoc, and it returns an unvalidated env value.

## Decision Rules

| Situation                                   | Prefer                                          | Avoid                                                       |
| ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| A file pushes past ~200 lines               | split it by responsibility                      | one growing catch-all                                      |
| A value might be absent                     | a neutral domain value (null-object)            | leaking `null`/`undefined` through call sites              |
| Tempted to add a wrapper/option "for later" | the simplest thing that meets today's need      | speculative generality                                     |
| An interior function could receive bad data | trust the boundary that validated it            | defensive re-checks                                        |
| Tempted to reach for a small library        | a few lines against Node built-ins              | a runtime dependency target projects would inherit         |
| A comment seems necessary                   | a clearer name, or a context/why comment        | restating the code                                         |
| Hashing text content                        | the shared `hashBuffer()` helper                | a second hashing path or raw-byte comparison for text      |

## Maintenance Rules

- New code conventions go here first; the coder writes to this doc and the reviewer checks against it.
- Keep examples drawn from real code; delete any that drift.
- Architectural rules (module layering, the dependency direction, the zero-dependency guarantee) live
  in `AGENTS.md` and `README.md`, not here.

## Known Limitations

- The ~200-line cap and "small function" guidance are judgment calls, not tool-enforced; the reviewer
  applies them.

## Open Questions

Intentionally empty: no unresolved coding-convention questions currently identified.

## Reference

- [Unit Testing Conventions](./unit-testing-conventions.md)
- [Code Review Conventions](./reviewing-conventions.md)
- [Documentation Markdown Contract](./documentation-md-contract.md)
