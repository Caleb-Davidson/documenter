---
title: Diagram Examples
section: Guides
description: Working samples of the diagram formats the docs shell supports and how each renders on a git host.
template: ./templates/document-template.md
---

## Purpose

Show the diagram formats the docs shell can render, so authors can pick one and
copy a working sample. This page doubles as a visual test: if the shell renders
correctly, all three diagrams below appear as themed graphics in light and dark mode.

## Primary Section

Three diagram formats are supported. **Mermaid is the preferred default** — it is
human-readable and diffable, and both it and referenced SVGs render in the shell
*and* natively on Git hosts. Inline SVG renders only in the shell.

- **Mermaid (preferred)** — a fenced `mermaid` code block. Lowest authoring effort;
  the shell themes it to the docs palette, and Git hosts render it natively.
- **Referenced SVG** — a standalone `.svg` in `assets/diagrams/` linked as an
  image. Full manual layout control; travels with the file everywhere.
- **Inline SVG** — the `diagram-frame` wrapper. Supported, but renders only in the
  shell (Git hosts strip it).

## Structured Data

| Format | Renders in shell | Renders in git repo view | Layout control |
|--------|------------------|--------------------------|----------------|
| Mermaid | Yes, themed | Yes, host's own theme | Auto (limited) |
| Referenced SVG | Yes, framed | Yes, as a bare image | Full, manual |
| Inline SVG | Yes | No (stripped) | Full, manual |

## Embedded HTML Example

The same flow, authored as mermaid:

```mermaid
flowchart LR
    A[Markdown] --> B[Docs Shell] --> C[Rendered Page]
```

And as a referenced SVG, copied from `templates/diagram-template.svg` and themed to
match:

![Markdown to docs shell to rendered page](./assets/diagrams/pipeline.svg)

And as inline SVG (`diagram-frame`), which renders in the shell only:

<div class="diagram-frame">
  <svg width="546" height="70" viewBox="0 0 546 70" role="img" aria-labelledby="inline-flow-title">
    <title id="inline-flow-title">Markdown to docs shell to rendered page</title>
    <defs>
      <marker id="inline-flow-arrow" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    <rect class="diagram-node" x="8" y="8" width="126" height="54" rx="4" />
    <text class="diagram-label" x="71" y="40" text-anchor="middle">Markdown</text>
    <rect class="diagram-node" x="184" y="8" width="140" height="54" rx="4" />
    <text class="diagram-label" x="254" y="40" text-anchor="middle">Docs Shell</text>
    <rect class="diagram-node" x="374" y="8" width="164" height="54" rx="4" />
    <text class="diagram-label" x="456" y="40" text-anchor="middle">Rendered Page</text>
    <path class="diagram-arrow" marker-end="url(#inline-flow-arrow)" d="M134 35 L182 35" />
    <path class="diagram-arrow" marker-end="url(#inline-flow-arrow)" d="M324 35 L372 35" />
  </svg>
  <div class="diagram-caption">Inline SVG renders in the shell but is stripped on Git hosts.</div>
</div>

## Notes

Both formats share one palette, so a mermaid diagram and a referenced SVG look the
same in the shell. On a git host they diverge: mermaid uses the host's theme, and
the referenced SVG keeps documenter's palette but loses its card frame.

Inline SVG (the `diagram-frame` pattern) still renders in the shell but is stripped
by most git hosts, so reserve it for shell-only docs.

Writing rules are defined in [Documentation Style Guide](./documentation-style-guide.md).
Platform behavior is defined in [Documentation Architecture](./documentation-architecture.md).
Requirements for new pages are defined in [Documentation Markdown Contract](./documentation-md-contract.md).
