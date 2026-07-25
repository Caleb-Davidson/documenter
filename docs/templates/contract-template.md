---
title: Contract Template
section: Templates
description: Copyable template for documents that define enforceable structure, compatibility rules, or system-facing requirements.
---

## Purpose

Define the contract this document establishes, who or what must follow it, and why the contract exists.

This section should answer:

- What thing is being standardized?
- Who consumes or depends on this contract?
- What breaks when the contract is not followed?

## Scope

Describe what this contract governs.

### In scope

- {Requirement area this contract controls}
- {Requirement area this contract controls}
- {Requirement area this contract controls}

### Out of scope

- {Related area intentionally governed elsewhere}
- {Related area intentionally governed elsewhere}

## Contract Summary

Provide a short, scannable summary of the contract.

| Area | Contract |
|---|---|
| {Area} | {Required behavior, structure, or rule} |
| {Area} | {Required behavior, structure, or rule} |
| {Area} | {Required behavior, structure, or rule} |

## Required Structure

Describe the required structure that valid contract participants must follow.

Use this section for document structure, file layout, payload shape, directory shape, page structure, command structure, or other required organization.

Example:

```text
{Required top-level structure}
├── {Required child}
├── {Required child}
└── {Required child}
```

Rules:

- {Structural rule}
- {Structural rule}
- {Structural rule}

## Required Fields

Use this section when the contract includes required fields, attributes, keys, properties, metadata, parameters, or sections.

| Field | Required | Purpose | Notes |
|---|---:|---|---|
| `{field}` | Yes | {Purpose} | {Constraint, default, or validation note} |
| `{field}` | Yes | {Purpose} | {Constraint, default, or validation note} |
| `{field}` | No | {Purpose} | {Constraint, default, or validation note} |

Intentionally empty: this contract does not define required fields.

## Allowed Patterns

List approved patterns that satisfy the contract.

Use this section to reduce ambiguity. Prefer concrete examples over abstract descriptions.

### Pattern: {Pattern name}

**Use when:** {Scenario where this pattern applies}

**Contract:** {Required behavior or shape}

```text
{Minimal example}
```

**Notes:**

- {Important constraint}
- {Important constraint}

## Prohibited Patterns

List patterns that violate the contract or create maintenance risk.

| Prohibited pattern | Why it is prohibited |
|---|---|
| {Pattern} | {Reason} |
| {Pattern} | {Reason} |
| {Pattern} | {Reason} |

## Processing Behavior

Describe how the system, tool, runtime, or workflow interprets contract-compliant content.

This section should explain behavior that is not obvious from the required structure alone.

### Behavior: {Behavior name}

1. {Processing step}
2. {Processing step}
3. {Processing step}

**Result:** {Observable result}

**Contract implication:** {What authors or callers must account for}

## Validation Rules

Describe how contract compliance is checked.

| Rule | Enforcement | Failure behavior |
|---|---|---|
| {Rule} | {Manual/tool/pre-commit/build/runtime} | {What happens when invalid} |
| {Rule} | {Manual/tool/pre-commit/build/runtime} | {What happens when invalid} |
| {Rule} | {Manual/tool/pre-commit/build/runtime} | {What happens when invalid} |

Intentionally empty: this contract is currently enforced by review rather than automated validation.

## Compatibility Rules

Describe compatibility expectations across versions, tools, environments, or consumers.

Use this section only when compatibility affects authoring or implementation decisions.

- {Compatibility rule}
- {Compatibility rule}
- {Compatibility rule}

Intentionally empty: this contract does not currently define version or environment compatibility rules.

## Integration Points

List systems, tools, files, workflows, or consumers that depend on this contract.

| Integration | Direction | Contract dependency | Notes |
|---|---:|---|---|
| {System/tool/file} | {Read/Write/Bidirectional} | {What part of the contract it relies on} | {Relevant note} |
| {System/tool/file} | {Read/Write/Bidirectional} | {What part of the contract it relies on} | {Relevant note} |

## Examples

Use examples only when they clarify contract usage.

### Valid example

```text
{Minimal valid example}
```

**Why this is valid:** {Short explanation}

### Invalid example

```text
{Minimal invalid example}
```

**Why this is invalid:** {Short explanation}

## Authoring Checklist

Use this checklist when creating or updating contract-compliant content.

1. {Checklist item}
2. {Checklist item}
3. {Checklist item}
4. {Checklist item}
5. {Checklist item}

## Known Limitations

Intentionally empty: no high-value contract limitations currently identified.

## Open Questions

Intentionally empty: no meaningful unresolved contract questions currently identified.

## Reference

Link related documents inline where they are relevant. Use this section only for canonical references that apply to the whole contract.

- [{Reference name}]({relative-link})
