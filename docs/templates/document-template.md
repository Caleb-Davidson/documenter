---
title: Document Template
section: Templates
description: Reference implementation for new documentation pages.
---

## Purpose

State what this document covers and why it exists.

## Primary Section

Put the most important system statement first.

- Use bullets for grouped facts.
- Keep each item short and direct.

## Structured Data

| Field | Meaning |
|-------|---------|
| Name | Describe the field or concept. |

## Embedded HTML Example

Use this pattern when Markdown alone cannot express the element.

<div class="diagram-frame">
  <svg width="400" height="70" viewBox="0 0 400 70" role="img" aria-labelledby="template-flow-title template-flow-desc">
    <title id="template-flow-title">Template flow example</title>
    <desc id="template-flow-desc">A small example showing an input transformed into output.</desc>
    <defs>
      <marker id="template-arrow" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    <rect class="diagram-node" x="8" y="8" width="150" height="54" rx="4" />
    <text class="diagram-label" x="83" y="40" text-anchor="middle">Input</text>
    <rect class="diagram-node" x="242" y="8" width="150" height="54" rx="4" />
    <text class="diagram-label" x="317" y="40" text-anchor="middle">Output</text>
    <path class="diagram-arrow" marker-end="url(#template-arrow)" d="M158 35 L240 35" />
  </svg>
  <div class="diagram-caption">Use existing shared classes; avoid page-local CSS.</div>
</div>



## Notes

Replace placeholder text, keep headings literal, and remove unused sections.

Writing rules are defined in [Documentation Style Guide](./documentation-style-guide.md).
Platform behavior is defined in [Documentation Architecture](./documentation-architecture.md).
Requirements for new pages are defined in [Documentation Markdown Contract](./documentation-md-contract.md).
