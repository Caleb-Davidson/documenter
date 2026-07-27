---
title: Code Review Conventions
section: Conventions
description: What a code review looks for, what it leaves alone, how findings are sized, and how they are written.
template: ./templates/standard-template.md
---

## Purpose

Code review here catches what the mechanical gate cannot: logic defects, unintended behavior changes,
poor fit with the codebase, and genuine maintainability traps. This standard defines what to flag,
what to ignore, how to size severity, and how to write a finding — so reviews stay high-signal and
consistent across the reviewer agent, the `/code-review` skill, and human reviewers.

It prevents both failure modes: missed defects, and noisy low-value findings that bury the ones that
matter.

## Scope

### In scope

- Reviewing a diff against its stated intent or acceptance criteria.
- What to flag, what to skip, severity, and finding style.
- Documentation content quality — accuracy, completeness, and adherence to the documentation style
  guide.

### Out of scope

- The mechanical gate — the `node --test` suite and the `documenter lint` docs check are enforced by
  `npm run verify`, not reviewed.
- Documentation structural compliance — frontmatter fields, heading order, link policy, and HTML
  policy are enforced by `npm run docs:lint`; do not re-flag them.
- Unit-test authoring — see [Unit Testing Conventions](./unit-testing-conventions.md).

## Philosophy

- **Judge the change on its own merits, not the author's narrative.** The value of review is catching
  what the author rationalized.
- **A finding must be falsifiable and concrete.** Be certain, or say you are unsure — never flag a
  hypothetical with no realistic trigger.
- **Calibration beats coverage.** A few high-confidence findings are worth more than a long list of
  maybes. Default to not blocking.
- **Review only what changed** — the diff and what it affects, not pre-existing code it left alone.
- **The gate owns the mechanical checks; review owns what the gate cannot see.**

## Core Rules

| Rule                 | Required practice                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Review the diff      | Judge the changed lines and what they affect; do not review untouched pre-existing code.             |
| Be certain           | Confirm a suspicion before flagging; if you still cannot, say you are unsure rather than assert.      |
| Calibrate            | Prefer a few high-confidence findings; default to not blocking.                                      |
| Leave the gate alone | Never flag test-run results or docs-contract structural issues — `npm run verify` owns them.         |
| State the trigger    | Every finding names the inputs or conditions under which it bites; severity reflects them.           |

## Required Practices

### Practice: Enforce the sibling standards

**Requirement:** The change must comply with the project's other standards — its code with
[Coding Conventions](./coding-conventions.md), and its tests with
[Unit Testing Conventions](./unit-testing-conventions.md). Flag a clear violation of either as a named
finding that cites the standard, not as a preference. These standards apply to test files equally.

A clear violation of a written rule in either standard is always **Blocking** — never Optional. The
conventions are non-negotiable defaults; whether the author agrees is not a factor in the severity.

In particular: any comment that references the current task, PR, or development lifecycle ("failing
until built", "added for the X flow", "waiting on Y to be implemented") violates the comment rule in
both standards. Flag these as **Blocking** — they are guaranteed to be stale by the time review runs
and mislead future readers.

Likewise flag, as **Blocking**, comments that are changelog-in-disguise — narrating what the code used
to do or how it changed, or denying a treatment the reader never expected (`no longer special-cased`,
`rather than X`) — and comments that catalog the decisions made around the code instead of stating the
one non-obvious _why_. Also flag a new runtime dependency, or a non-built-in import reaching into
`bin/`/`src/`, as **Blocking** — it breaks the zero-dependency guarantee.

**Reason:** Those standards are the source of truth; review is where they are actually enforced on a
change.

### Practice: Review documentation changes

**Requirement:** When the diff changes behavior, architecture, commands, or conventions, confirm that
the relevant `docs/` pages, `AGENTS.md`, and `README.md` were updated in the same change. A behavior
change with no corresponding documentation update is **Blocking**. When the change touched anything
under `template/`, confirm `template/manifest.json` was regenerated.

For any docs the diff does touch, check them against the
[Documentation Style Guide](./documentation-style-guide.md) for:

- **Inaccuracy** — the doc says something the code no longer does. **Blocking.**
- **Speculative or roadmap language** — future-tense commitments in a standards or architecture doc.
  **Blocking** — the style guide prohibits it; it weakens authoritativeness and rots.
- **Restating implementation** — narrating what the code does line-by-line rather than explaining
  intent, boundaries, or tradeoffs. **Blocking.**
- **Duplicating a canonical doc** — re-explaining a concept an existing doc already owns instead of
  linking to it. **Blocking.**
- **Changelog framing** — narrating the design as a change from a prior state (`now X instead of Y`,
  `no longer`, `replaces the former`). **Blocking.**

**Reason:** The documentation style guide defines these as authoring violations; review is the only
enforcement point because no automated tool checks content quality.

### Practice: Look for correctness defects first

**Requirement:** Correctness is the primary focus — wrong logic, off-by-one errors, incorrect
conditionals, missing or incorrect guards, unreachable paths, unhandled edge cases (missing file,
empty input, error conditions), broken invariants, and anything that fails an acceptance criterion.

**Reason:** These are the defects the gate cannot catch.

### Practice: Scrutinize error handling and filesystem effects

**Requirement:** Flag swallowed failures, unexpected throws, and thrown error types nothing upstream
catches. Because the CLI reads and writes real files in a user's project and spawns `git`, pay
attention to what happens on a partial write, a missing target, a non-repo target, or a spawned
process that fails — a silently swallowed error there corrupts a user's tree or misclassifies drift.

**Reason:** Broken error handling around the filesystem boundary hides failure and is easy to miss in a
green test run.

### Practice: Flag unintended behavior changes

**Requirement:** If the change alters behavior the acceptance criteria do not describe — especially the
drift classification, what gets written, or the state file — raise it, especially when it looks
accidental.

**Reason:** Silent behavior drift is how regressions enter.

### Practice: Check that the change fits the codebase

**Requirement:** Confirm it follows existing patterns and reuses established helpers instead of
reinventing them. Flag genuinely excessive nesting, over-engineering, or dead/over-defensive code — as
named findings, not as preference.

**Reason:** Reinvention, deep nesting, and speculative complexity are maintainability costs the tooling
cannot catch.

### Practice: Verify or abstain

**Requirement:** Before flagging, confirm with Read/Grep/Glob — check the real definition, its usages,
and how existing code handles the same problem. If you still cannot confirm it, write "I am not sure
about X" rather than asserting a defect.

### Practice: State the scenario and right-size severity

**Requirement:** Every finding names the inputs, environment, or conditions under which the issue
arises, and the severity reflects how likely and impactful they are. Do not overstate.

**Example:**

```text
`update` writes the state entry to the on-disk hash even when it skipped a drifted file (update.mjs:111).
Triggers whenever a user has locally modified a managed file: a later revert-to-stock is no longer
detected. Blocking — it breaks the documented drift model.
```

## Prohibited Practices

| Prohibited practice                                           | Why it is prohibited                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Formatting or style comments of any kind                      | There is no formatter gate here, but style bikeshedding is still noise; flag substance, not whitespace preference.       |
| Hypothetical problems with no realistic trigger               | Noise; if an edge case matters, give the concrete scenario.                                                             |
| Reviewing pre-existing code outside the diff                  | Out of scope for a change review.                                                                                       |
| Flattery or filler ("Great job", "Thanks for")                | Adds nothing and buries the signal.                                                                                     |
| Overstating severity                                          | Erodes trust in the review.                                                                                             |
| Re-reporting anything the gate enforces                       | Redundant — the test suite and docs lint already passed.                                                                |
| Re-flagging documentation structural issues the gate enforces | `documenter lint` owns frontmatter, heading order, link policy, and HTML policy — same principle as not flagging tests. |

## Patterns

### Pattern: A well-formed finding

**Use when:** writing up any issue.

**Pattern:**

```text
<what is wrong> at <file:line>. <why it is wrong>. Triggers when <scenario>.
Severity: Blocking | Optional — because <reason tied to the trigger>.
```

**Notes:**

- Matter-of-fact and concise; written to be understood at a glance.
- No flattery, no filler, and no hedging where you are actually certain.

### Pattern: Confirm before flagging

**Use when:** you suspect a defect but are not certain.

**Pattern:**

```text
Grep the symbol's definition and usages → Read the relevant code →
flag only if confirmed; otherwise report "not sure about X".
```

## Examples

### Strong example

```text
`writeManagedFile` normalizes to LF then re-emits with the requested EOL, but the binary branch also
runs the normalizer (fs.mjs:42), so a binary asset gets its CRLF-looking bytes rewritten and its hash
changes. Triggers for any file `isTextFile()` reports false on. Blocking — it corrupts binary assets.
```

**Why this works:** names the defect and location, gives the exact failure, states the trigger, and
ties the severity to impact. No filler.

### Weak example

```text
Great work here! One small thing — you might want to consider possibly handling the case where the
input could theoretically be missing, just to be safe.
```

**Why this should be changed:** flattery, a hypothetical with no realistic trigger, no `file:line`, and
no severity. It is noise.

## Decision Rules

| Situation                                        | Prefer                                                                     | Avoid                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------- |
| Unsure whether something is a defect             | investigate, then say "not sure" if unconfirmed                            | flagging it as a definite bug          |
| An edge case might matter                        | give the concrete scenario that breaks it                                  | a vague "what if X is missing"         |
| A style choice differs from yours                | leave it — substance over whitespace                                       | flagging preference                    |
| The code touches the filesystem or spawns a process | check the partial-write / missing-target / failed-spawn paths           | inventing risks with no realistic trigger |
| The diff changes behavior but docs are untouched | check if relevant docs needed updating; Blocking if so                     | assuming the author kept docs in sync  |
| Code changed but no new comment was added        | leave it — only flag when non-obvious reasoning is genuinely absent        | requiring comments for every change    |
| A comment is accurate but plainly worded         | pass it — only fail for inaccuracy, staleness, or pure filler              | failing adequate-but-not-elegant wording |

## Maintenance Rules

- New review conventions go here first; the reviewer agent and the `/code-review` skill read this doc.
- Keep the taxonomy and examples current; delete any that drift from the code.
- Add a dedicated security/concurrency section if the CLI ever grows a network boundary or genuine
  concurrency — not before.

## Known Limitations

- Severity is a two-tier model (Blocking, Optional) tuned to the gate-then-review pipeline; a richer
  scale is not needed yet.

## Open Questions

Intentionally empty: no unresolved review-convention questions currently identified.

## Reference

- [Coding Conventions](./coding-conventions.md)
- [Unit Testing Conventions](./unit-testing-conventions.md)
- [Documentation Style Guide](./documentation-style-guide.md)
