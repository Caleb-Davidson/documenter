---
title: Documentation Style Guide
section: Reference
description: Rules for writing and structuring project documentation in this repository.
template: ./templates/standard-template.md
---

## Purpose

This standard defines how documentation is written so docs stay clear, current, and decision-useful for maintainers and AI agents.

## Scope

### In scope

- Architecture, standards, and contract docs under `docs/`.
- Writing style, section quality, and cross-reference behavior.
- Maintenance expectations for accuracy and drift prevention.

### Out of scope

- Shell runtime mechanics and rendering internals.
- Low-level structural contract constraints enforced in [Documentation Markdown Contract](./documentation-md-contract.md).

## Philosophy

Good docs explain intent, boundaries, and tradeoffs rather than mirroring implementation details.

- Optimize for future safe change, not for exhaustive narration.
- Prefer high-signal statements over verbose background.
- Treat terminology consistency as a contract with code.

## Core Rules

| Rule | Required practice |
|---|---|
| Source of truth | Document only what is true now; remove stale content quickly |
| Present tense | State behavior in present tense and explicit conditions |
| Boundary-first framing | Explain ownership, non-goals, and integration seams before detail |

## Required Practices

### Practice: concise decision-focused sections

**Requirement:** Each H2 section must communicate one decision-relevant topic.

**Reason:** Readers should quickly extract constraints, ownership, and behavior impact.

**Example:**

```text
## System Boundaries

- Owned by this system: ...
- Not owned by this system: ...
```

### Practice: canonical cross-references

**Requirement:** Link the canonical doc for a concept instead of repeating full explanations.

**Reason:** Reduces drift and keeps edits localized.

**Example:**

```text
Use [Documentation Markdown Contract](./documentation-md-contract.md) for structural authoring requirements.
```

## Prohibited Practices

| Prohibited practice | Why it is prohibited |
|---|---|
| Line-by-line restatement of obvious implementation | Adds noise and increases maintenance burden |
| Speculative roadmap language in standards docs | Weakens authoritativeness and creates stale guidance |
| Large code dumps in architecture/standards pages | Hides intent and discourages upkeep |

## Patterns

### Pattern: intentional-empty marker

**Use when:** A required section has no high-value current content.

**Pattern:**

```text
Intentionally empty: {short reason}.
```

**Notes:**

- Keep the reason concrete and current-state based.
- Remove the marker when meaningful content exists.

## Examples

### Strong example

```text
The docs shell is manifest-driven: a page is discoverable only when linked from docs/index.md.
```

**Why this works:** It states behavior, boundary, and implication in one concise statement.

### Weak example

```text
There are many components and files in this area.
```

**Why this should be changed:** It provides no actionable design or maintenance guidance.

## Decision Rules

| Situation | Prefer | Avoid |
|---|---|---|
| Existing canonical doc already covers concept | Link canonical doc with short local context | Duplicate full explanation |
| Section has no meaningful current content | Use intentional-empty marker | Generic filler text |
| Non-obvious architecture decision | Record decision + rationale (+ rejected alternatives if useful) | Implicit choices with no rationale |

## Maintenance Rules

- Update docs in the same change set when behavior changes.
- Remove stale or speculative text immediately.
- Keep parser/vendor runtime assets synced with `npm run docs:vendor` when dependencies change.

## Known Limitations

Intentionally empty: no high-value standard limitations currently identified.

## Open Questions

Intentionally empty: no meaningful unresolved standard questions currently identified.

## Reference

- [Documentation Markdown Contract](./documentation-md-contract.md)
- [Documentation Architecture](./documentation-architecture.md)
- [Standard Template](./templates/standard-template.md)
