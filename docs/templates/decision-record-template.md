---
title: Decision Record Template
section: Templates
description: Copyable template for recording important project, product, technical, or architecture decisions.
---

## Decision

State the decision in one or two direct sentences.

Example:

`Use window.localStorage as the primary persistence store for bounded local application data.`

## Status

Choose one:

- Proposed
- Accepted
- Superseded
- Rejected

**Current status:** {Status}

## Context

Explain the situation that led to this decision.

This section should answer:

- What problem or choice exists?
- What constraints matter?
- What goals does this decision support?
- Why does this decision need to be recorded?

## Decision Drivers

List the criteria that shape the decision.

- {Driver or constraint}
- {Driver or constraint}
- {Driver or constraint}

## Options Considered

| Option | Summary | Fit |
|---|---|---|
| {Option A} | {Short explanation} | {Strong/Partial/Weak} |
| {Option B} | {Short explanation} | {Strong/Partial/Weak} |
| {Option C} | {Short explanation} | {Strong/Partial/Weak} |

## Selected Option

**Selected:** {Option}

**Rationale:** {Why this option best fits the current goals and constraints.}

## Rejected Options

Record rejected alternatives only when the reason is non-obvious or likely to be revisited.

| Option | Why it was rejected |
|---|---|
| {Option} | {Reason} |
| {Option} | {Reason} |

Intentionally empty: no rejected options need to be recorded.

## Consequences

Describe the meaningful effects of the decision.

### Positive

- {Benefit}
- {Benefit}

### Negative

- {Tradeoff or cost}
- {Tradeoff or cost}

### Neutral / Follow-up

- {Required follow-up, migration, cleanup, or documentation update}

## Scope of Impact

Describe where this decision applies.

- {System, feature, module, workflow, or document affected}
- {System, feature, module, workflow, or document affected}

## Supersedes / Superseded By

Use only when this decision replaces or is replaced by another decision.

- Supersedes: {decision record link or "none"}
- Superseded by: {decision record link or "none"}

## Notes

- This record captures the decision and reasoning at the time it is made.
- Keep the document current if the decision changes.
- Do not use this template for trivial choices that are obvious from the code or current implementation.
