---
title: System Architecture Template
section: Templates
description: Copyable template for architecture-overview documents focused on intent, boundaries, and reasoning.
---

## Overview

Describe what the system does, why it exists, what problem it solves, and where it fits in the larger application.

<div class="diagram-frame">
  <svg viewBox="0 0 960 260" role="img" aria-labelledby="overview-diagram-title overview-diagram-desc">
    <title id="overview-diagram-title">System context overview</title>
    <desc id="overview-diagram-desc">A high-level context diagram with upstream input, this system boundary, and downstream consumers.</desc>
    <defs>
      <marker id="overview-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(100, 116, 139, 0.9)" />
      </marker>
    </defs>
    <rect class="diagram-node" x="40" y="92" width="220" height="76" rx="8" />
    <text class="diagram-label" x="150" y="138" text-anchor="middle">Upstream Input</text>
    <rect class="diagram-node" x="368" y="70" width="224" height="120" rx="8" />
    <text class="diagram-label" x="480" y="126" text-anchor="middle">{System Name}</text>
    <rect class="diagram-node" x="700" y="92" width="220" height="76" rx="8" />
    <text class="diagram-label" x="810" y="138" text-anchor="middle">Downstream Use</text>
    <path class="diagram-arrow" marker-end="url(#overview-arrow)" d="M 270 130 L 358 130" />
    <path class="diagram-arrow" marker-end="url(#overview-arrow)" d="M 602 130 L 690 130" />
  </svg>
  <div class="diagram-caption">Replace with the real system context diagram.</div>
</div>

## Goals

- {Architectural goal with a clear design pressure}
- {Architectural goal with a clear design pressure}
- {Architectural goal with a clear design pressure}

## Non-goals

- {Reasonable expectation that is intentionally out of scope}
- {Reasonable expectation that is intentionally out of scope}

## Design Constraints

- {Hard boundary the architecture must obey}
- {Hard boundary the architecture must obey}
- {Hard boundary the architecture must obey}

## Key Decisions

### {Decision title}

**Decision:** {What was chosen}

**Rationale:** {Why this choice was made}

**Rejected alternatives:**

| Alternative | Why it was rejected |
|---|---|
| {Alternative A} | {Reason} |
| {Alternative B} | {Reason} |

## System Boundaries

### Owned by this system

- {Responsibility this system controls}
- {Responsibility this system controls}

### Not owned by this system

- {Out-of-scope area that belongs elsewhere}
- {Out-of-scope area that belongs elsewhere}

### Depends on but does not control

- {Dependency and contract expectation}
- {Dependency and contract expectation}

## System Operation

### Owned Processes

Describe workflows this system is authoritative for.

<div class="diagram-frame">
  <svg viewBox="0 0 960 260" role="img" aria-labelledby="process-diagram-title process-diagram-desc">
    <title id="process-diagram-title">Owned process flow</title>
    <desc id="process-diagram-desc">An example process flow showing trigger, core steps, and resulting output.</desc>
    <defs>
      <marker id="process-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(100, 116, 139, 0.9)" />
      </marker>
    </defs>
    <rect class="diagram-node" x="40" y="96" width="180" height="68" rx="8" />
    <text class="diagram-label" x="130" y="136" text-anchor="middle">Trigger</text>
    <rect class="diagram-node" x="292" y="58" width="180" height="68" rx="8" />
    <text class="diagram-label" x="382" y="98" text-anchor="middle">Step 1</text>
    <rect class="diagram-node" x="292" y="136" width="180" height="68" rx="8" />
    <text class="diagram-label" x="382" y="176" text-anchor="middle">Step 2</text>
    <rect class="diagram-node" x="544" y="96" width="180" height="68" rx="8" />
    <text class="diagram-label" x="634" y="136" text-anchor="middle">Output</text>
    <path class="diagram-arrow" marker-end="url(#process-arrow)" d="M 230 130 L 282 130" />
    <path class="diagram-arrow" marker-end="url(#process-arrow)" d="M 472 92 L 534 122" />
    <path class="diagram-arrow" marker-end="url(#process-arrow)" d="M 472 170 L 534 138" />
  </svg>
  <div class="diagram-caption">Describe processes, not methods or files.</div>
</div>

### Process: {Name}

**Purpose:** {Why this process exists}

**Trigger:** {What starts the process}

**High-level flow:**

1. {Step}
2. {Step}
3. {Step}

**Important design notes:**

- {Architecture-level behavior or rule}
- {Architecture-level behavior or rule}

### Owned Data

Describe data this system is authoritative for.

| Data | Why it exists | Ownership notes |
|---|---|---|
| {Data object} | {Purpose} | {Boundary and authority} |
| {Data object} | {Purpose} | {Boundary and authority} |

### Data Flows

Describe how meaningful data moves through the system.

<div class="diagram-frame">
  <svg viewBox="0 0 960 240" role="img" aria-labelledby="data-flow-diagram-title data-flow-diagram-desc">
    <title id="data-flow-diagram-title">Data flow example</title>
    <desc id="data-flow-diagram-desc">An example data flow from source through transformation to destination.</desc>
    <defs>
      <marker id="data-flow-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(100, 116, 139, 0.9)" />
      </marker>
    </defs>
    <rect class="diagram-node" x="40" y="84" width="220" height="72" rx="8" />
    <text class="diagram-label" x="150" y="126" text-anchor="middle">Source</text>
    <rect class="diagram-node" x="370" y="84" width="220" height="72" rx="8" />
    <text class="diagram-label" x="480" y="126" text-anchor="middle">Transformation</text>
    <rect class="diagram-node" x="700" y="84" width="220" height="72" rx="8" />
    <text class="diagram-label" x="810" y="126" text-anchor="middle">Destination</text>
    <path class="diagram-arrow" marker-end="url(#data-flow-arrow)" d="M 270 120 L 360 120" />
    <path class="diagram-arrow" marker-end="url(#data-flow-arrow)" d="M 600 120 L 690 120" />
  </svg>
  <div class="diagram-caption">Focus on what moves where and why.</div>
</div>

### Flow: {Name}

1. {Step}
2. {Step}
3. {Step}

### Flow notes

- {Important flow rule}
- {Important flow rule}

## Integration Points

| Integration | Direction | Purpose | Notes |
|---|---:|---|---|
| {System or file} | {Read/Write/Bidirectional} | {Why integration exists} | {Contract details} |
| {System or file} | {Read/Write/Bidirectional} | {Why integration exists} | {Contract details} |

## Important Behaviors

### {Behavior name}

{Architecture-relevant behavior that is easy to misunderstand from code alone.}

### {Behavior name}

{Architecture-relevant behavior that is easy to misunderstand from code alone.}

## Runtime Sequences

Intentionally empty: no architecture-critical runtime sequences currently identified.

### Sequence: {Name}

<div class="diagram-frame">
  <svg viewBox="0 0 960 240" role="img" aria-labelledby="sequence-diagram-title sequence-diagram-desc">
    <title id="sequence-diagram-title">Runtime sequence example</title>
    <desc id="sequence-diagram-desc">An example sequence showing orchestrated runtime interactions.</desc>
    <defs>
      <marker id="sequence-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(100, 116, 139, 0.9)" />
      </marker>
    </defs>
    <rect class="diagram-node" x="80" y="90" width="170" height="60" rx="8" />
    <text class="diagram-label" x="165" y="126" text-anchor="middle">Actor A</text>
    <rect class="diagram-node" x="394" y="90" width="170" height="60" rx="8" />
    <text class="diagram-label" x="479" y="126" text-anchor="middle">Actor B</text>
    <rect class="diagram-node" x="708" y="90" width="170" height="60" rx="8" />
    <text class="diagram-label" x="793" y="126" text-anchor="middle">Actor C</text>
    <path class="diagram-arrow" marker-end="url(#sequence-arrow)" d="M 260 112 L 384 112" />
    <path class="diagram-arrow" marker-end="url(#sequence-arrow)" d="M 574 128 L 698 128" />
  </svg>
  <div class="diagram-caption">Use only when sequence detail is architecture-critical.</div>
</div>

**When this happens:** {Triggering scenario}

**Why this sequence matters:** {Architecture impact}

**High-level sequence:**

1. {Step}
2. {Step}
3. {Step}

**Design notes:**

- {Constraint, tradeoff, or behavior note}

## Observability and Debugging

### How to inspect the system

- {Verification action}
- {Verification action}

### Useful debugging surfaces

| Surface | Use |
|---|---|
| {Tool/file} | {What it helps verify} |
| {Tool/file} | {What it helps verify} |

## Known Limitations

Intentionally empty: no meaningful known limitations currently identified.

## Open Questions

Intentionally empty: no meaningful unresolved architecture questions currently identified.

## Notes

- This is an architecture overview, not an implementation reference.
- Do not restate code that is easy to discover directly from implementation.
- Leave sections empty when there is no high-value information to add.
- Use [Documentation Style Guide](./documentation-style-guide.md) for writing rules.
- Use [Documentation Markdown Contract](./documentation-md-contract.md) for page-authoring requirements.
