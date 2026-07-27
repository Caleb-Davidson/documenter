---
title: Unit Testing Conventions
section: Conventions
description: How unit tests are written for the documenter CLI — what to test, what not to, and the node:test house style.
template: ./templates/standard-template.md
---

## Purpose

Unit tests exist to catch real defects in the logic we own — not to restate data or mirror the
implementation. This standard defines what to test, what to leave untested, and the house style, so
tests stay high-signal and everyone — human or agent — writes them the same way.

It prevents two failure modes: noisy tests that can never fail for a real bug (transcribed data,
recomputed expectations), and silent gaps in coverage of the logic that matters.

## Scope

### In scope

- `node:test` unit tests (`test/*.test.mjs`) for the CLI, its libraries, and the standalone linter.
- What to test, what to exclude, and how tests are written and named.

### Out of scope

- General coding and code-review conventions — see [Coding Conventions](./coding-conventions.md) and
  [Code Review Conventions](./reviewing-conventions.md). Those apply to test code too, except the
  public-JSDoc rule (test functions are not exports) and the ~200-line file-size cap (test files grow
  with coverage).
- The documenter authoring contract — see the [Documentation Markdown Contract](./documentation-md-contract.md).

## Philosophy

- **Test the logic you own.** Data is not logic, and libraries are not ours. A test earns its place
  only if it can fail for a real bug in our code.
- **A test must be falsifiable by a bug, not by a transcription.** If the expected value is copied
  from the source of truth or recomputed by the same formula under test, the test proves nothing.
- **Tests are documentation.** Meaning comes from descriptive names, clear variables, and structure —
  not from comments.
- **A bad test is worse than no test.** A test that cannot fail for a real bug creates false
  confidence, adds maintenance burden, and obscures the gaps that actually matter.

## Core Rules

| Rule                     | Required practice                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Test what we own         | Never test data tables, barrel exports, pure passthroughs, boilerplate, or external libraries.                                              |
| Logic over data          | Test the logic that consumes data; never assert hardcoded data-table values, and never recompute the expected in-test.                       |
| Test the public surface  | Exercise behavior through public APIs and real entry points; do not reach into private helpers.                                             |
| Test at the owning layer | Assert a behavior in the module that implements it. When code delegates through an injected seam, stub it with an arbitrary value and assert only that the code honors the result — never the collaborator's policy. |
| Stay deterministic       | Materialize fixtures in fresh temp dirs and clean them up; no wall-clock, no cross-test state, no reliance on execution order.               |
| Self-document            | Descriptive test names and variables carry the meaning. Comments follow production-code rules: only a non-obvious WHY. No task-lifecycle language anywhere. |
| AAA by whitespace        | Separate Arrange, Act, and Assert with blank lines — never section comments.                                                                |
| One behavior per test    | Each test verifies a single behavior; split unrelated assertions into separate, named tests.                                                |

## Required Practices

### Practice: Follow the project's node:test setup

**Requirement:** Tests are `node:test`, in `test/*.test.mjs`, run via `node --test` (auto-discovered by
the `test` script). Import `test` from `node:test` and `assert` from `node:assert/strict` explicitly —
there are no injected globals and no third-party test framework, consistent with the CLI's
zero-runtime-dependency rule. Materialize any fixture tree in a fresh temp dir and remove it in a
`finally`, as `test/docs-lint.test.mjs` does.

**Reason:** Staying on Node built-ins keeps the CLI dependency-free even in its tests; temp-dir
fixtures keep each case isolated and deterministic.

### Practice: Exercise the real entry point end-to-end

**Requirement:** Where a behavior is a whole-command or whole-linter contract, drive it the way a user
does — spawn the real script against a temp-dir fixture and assert on its exit code and output — rather
than importing and poking internals. Reserve direct-import unit tests for pure library functions whose
contract is the function itself.

**Reason:** The linter's and the CLI's contract is their observable behavior (exit code, emitted
diagnostics, files written); testing that contract through the real entry point catches integration
mistakes a white-box test of one helper would miss, while staying a fast, deterministic unit test.

**Example:**

```js
const result = spawnSync(process.execPath, [LINTER], { cwd: fixtureRoot, encoding: "utf-8" });
assert.equal(result.status, 1, result.stdout + result.stderr);
assert.match(result.stderr, /does not exist in docs\//);
```

### Practice: Assert precomputed literals

**Requirement:** Assert a hardcoded expected value. If it needs justifying, show the derivation in a
one-line comment — never compute it in the test with the same logic the code uses.

**Reason:** Recomputing the expected value with the code's own formula makes the test pass against its
own bug. A literal is an independent check.

### Practice: Cover representative good and bad inputs

**Requirement:** Test a representative sample of valid inputs and the error paths the function is
contractually required to handle. Assert errors specifically — a message or exit-code match, never a
bare "did not throw". On the happy path, if the function produced a value, assert what it produced;
don't rely on a bare no-throw as the sole proof. Do not test inputs a boundary already rejects.

**Reason:** Confidence comes from exercising both the happy path and the failure path — but defending
against states that cannot occur is noise in the code and the tests alike.

### Practice: Keep tests deterministic

**Requirement:** Never depend on wall-clock, ambient environment, execution order, or shared mutable
state. Give each case its own temp dir and tear it down; if a case needs an env var (e.g.
`DOCUMENTER_EOL`), set it for that spawn only.

**Reason:** documenter's classification is reproducible by design; a flaky test would undermine the
guarantee it is meant to protect.

## Prohibited Practices

| Prohibited practice                                          | Why it is prohibited                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AAA section comments (`// Arrange`, `// Act`, `// Assert`)   | Blank lines already separate the phases; the labels are pure noise.                                                                              |
| Asserting hardcoded data-table values                        | Tautological — it transcribes the source of truth and can never catch a bug.                                                                     |
| Recomputing the expected value in the test                   | Mirrors the implementation, so a wrong formula passes against itself.                                                                            |
| Testing barrel exports, passthroughs, or boilerplate         | No logic to verify.                                                                                                                              |
| Testing external library behavior                            | Not ours to test; trust the dependency.                                                                                                          |
| Mocking a helper you could call directly                     | Couples the test to implementation; call the real same-module function. (Stubbing an injected cross-layer seam is different and expected.)       |
| Asserting a collaborator's policy through a stub             | Duplicates the test in the module that owns the policy; the stub is fed the very values the test asserts, so it can never fail for a real bug.   |
| Explanatory comments where a clearer name would do           | Tests should self-document.                                                                                                                      |
| Task-lifecycle or changelog comments                         | "Failing until built", "red tests written first" — these reference the current task and are stale the moment the feature lands. Never in code.   |
| Generic or untightenable assertions                          | If the scenario could break while the assertion still passes, the test proves nothing — `assert.ok(x)`, `assert(x > 0)`, or anything looser than the actual expected value. |
| Bare no-throw as the sole assertion                          | Proving a call did not crash is not proving it computed anything correct. Pair it with a meaningful assertion or omit it.                        |
| Testing that exports exist or are shaped a certain way       | Constructing a value just to instantiate it is not a logic test — it cannot catch a bug.                                                         |

## Patterns

### Pattern: Temp-dir fixture, real entry point

**Use when:** verifying an end-to-end CLI or linter behavior.

**Pattern:**

```js
function runLint(files) {
  const root = mkdtempSync(join(tmpdir(), "documenter-lint-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, "utf-8");
    }
    const r = spawnSync(process.execPath, [LINTER], { cwd: root, encoding: "utf-8" });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
```

**Notes:**

- Each case builds only the fixture it needs and cleans up in `finally`, so cases never interfere.
- Assert on the observable contract — exit code and diagnostics — not on internal state.

### Pattern: Derivation comment, literal assertion

**Use when:** an expected value is the result of a non-obvious computation.

**Pattern:**

```js
// SHA-256 of the LF-normalized bytes of "a\nb\n" — precomputed once, independent of the code path.
assert.equal(hashBuffer(Buffer.from("a\r\nb\r\n"), true), "…precomputed hex…");
```

**Notes:**

- The comment shows where the literal came from; the assertion is the independent check.
- Never replace the literal with the computed expression.

## Examples

### Strong example

```js
test("a text file re-saved with CRLF is not classified as drift", () => {
  const root = writeTree({ "docs/page.md": "a\r\nb\r\n" });

  const classification = classify(root, "docs/page.md");

  assert.equal(classification, "current");
});
```

**Why this works:** the name states the behavior, AAA shows through blank lines (no labels), the
assertion is a literal, and it covers one behavior.

### Weak example

```js
test("hash test", () => {
  // Arrange
  // Act + Assert
  for (const [text, isText] of Object.entries(FIXTURES)) {
    assert.equal(hashBuffer(Buffer.from(text), isText), createHash("sha256").update(text).digest("hex"));
  }
});
```

**Why this should be changed:** a vague name, AAA section comments, and it recomputes the expected hash
with the implementation's own logic — so it can never catch a bug.

## Decision Rules

| Situation                                                    | Prefer                                                                | Avoid                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------- |
| Many input/output pairs for one function                     | a table-driven test over the logic, literal expecteds                 | transcribing a data table or recomputing  |
| A test feels like it needs a comment                         | a clearer test name or variable                                       | an explanatory comment                    |
| Verifying a whole-command behavior                           | spawn the real entry point against a temp-dir fixture                 | poking one internal helper in isolation   |
| Tempted to test a value in a data table                      | test the logic that reads it                                          | asserting the data values directly        |
| A behavior is decided by an injected seam                    | stub it with an arbitrary value; assert your code honors it           | encoding the collaborator's real values in the stub and asserting them |
| A test is narrow but verifies a real behavior                | pass it — a focused test that catches one real regression is valuable | padding it with unrelated assertions      |

## Maintenance Rules

- When a new unit-testing convention is decided, add it here first — this doc is the source the tester
  and reviewer agents read.
- Keep examples minimal and current; delete any that drift from the code.
- There is no coverage gate wired today, so coverage is a discipline, not a threshold: aim to exercise
  every branch of the logic you own, and flag a genuinely un-unit-testable branch to the lead rather
  than contriving a test for it.

## Known Limitations

- Coverage is not tool-enforced; the full-coverage intent above is a review-time judgment, not a gate.

## Open Questions

Intentionally empty: no unresolved unit-testing questions currently identified.

## Reference

- [Coding Conventions](./coding-conventions.md)
- [Code Review Conventions](./reviewing-conventions.md)
- [Documentation Markdown Contract](./documentation-md-contract.md)
