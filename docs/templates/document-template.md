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
  <svg viewBox="0 0 640 180" role="img" aria-labelledby="template-flow-title template-flow-desc">
    <title id="template-flow-title">Template flow example</title>
    <desc id="template-flow-desc">A small example showing an input transformed into output.</desc>
    <defs>
      <marker id="template-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(100, 116, 139, 0.9)" />
      </marker>
    </defs>
    <rect class="diagram-node" x="40" y="54" width="220" height="72" rx="8" />
    <text class="diagram-label" x="150" y="96" text-anchor="middle">Input</text>
    <path class="diagram-arrow" marker-end="url(#template-arrow)" d="M 270 90 L 370 90" />
    <rect class="diagram-node" x="380" y="54" width="220" height="72" rx="8" />
    <text class="diagram-label" x="490" y="96" text-anchor="middle">Output</text>
  </svg>
  <div class="diagram-caption">Use existing shared classes; avoid page-local CSS.</div>
</div>



## Notes

Replace placeholder text, keep headings literal, and remove unused sections.

Writing rules are defined in [Documentation Style Guide](./documentation-style-guide.md).
Platform behavior is defined in [Documentation Architecture](./documentation-architecture.md).
Requirements for new pages are defined in [Documentation Markdown Contract](./documentation-md-contract.md).
