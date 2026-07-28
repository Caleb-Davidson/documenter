---
name: issue-triage
description: Procedure for authoring, triaging, decomposing, and reprioritizing this repo's work items, which live as Gitea issues (not a TODO file). Use whenever the user wants to add a new task/idea to the backlog, file an issue, split a big item into smaller ones, move something between the next and someday tiers, or mark work in progress — phrasings like "add a TODO", "file an issue for X", "put this on the backlog", "break this epic up", "bump this to someday". Reading the backlog is not this skill — that is the tracker's list command (see AGENTS.md).
---

# Issue Triage — Authoring & Managing Work Items

This repo tracks work as **Gitea issues**, not a TODO file. This skill is the **write/manage** side:
creating a well-formed issue, triaging its tier, decomposing an epic, and reprioritizing. Reading the
backlog is separate — that is the tracker's list command (named in `AGENTS.md` → Commands), which
every session already runs at step 1.

The repo-specific facts this skill needs — the **repo slug** (`owner/name`), the **area labels**, the
**canonical taxonomy source**, and the **tracker commands** — all live in `AGENTS.md`. Read them there;
this skill is the procedure, `AGENTS.md` is the parameters.

Two companions own the pieces this skill does not:

- **Canonical taxonomy and rationale** (the labels, the neutral-default and lazy-milestone rules, and
  the why behind them): whatever `AGENTS.md` points to — an ADR under `docs/decisions/` if the repo
  keeps one, otherwise `AGENTS.md` itself. This skill applies that decision; it is not its source of truth.
- **API mechanics** (host URLs, bot-token auth, endpoint shapes): your Gitea REST API reference.
  Consult it before any write call.

## The taxonomy, operationally

The canonical source (see above) governs; this is the cheat-sheet:

- **Status** — decides the tracker section. `in-progress` (claimed, being worked) outranks `blocked`
  (committed work waiting on named blocker issues), which outranks `someday` (deferred / maybe). An
  issue with **none** is the default: the active **next** queue. Never add a `next` label; "next" is
  the absence of the others.
- **Area** — which part of the codebase the work touches. **The concrete area labels are listed in
  `AGENTS.md`** (they differ per repo). Apply every area that genuinely applies; multi-label is
  expected. A cross-cutting umbrella that fits no single area carries no area label.

No priority scale, no type labels (`bug`/`chore`) yet — add `bug` the day the first real bug appears,
not before.

## Authoring a new issue — the checklist

Walk these in order. Steps 2 and 4 are the ones to do **with the user**, not guess.

1. **Area labels.** Decide which part(s) of the codebase the work touches, from the set in `AGENTS.md`.
   Cross-cutting → multiple; a phase umbrella that fits no area → none.
2. **Tier — ask, don't assume.** Is this actionable soon (**next**, no status label) or deferred
   (**someday**)? When it is not obvious, ask the user rather than defaulting silently.
3. **Draft title + body.**
   - Title: a terse, specific summary in the house voice (see the existing issues for tone).
   - Body: preserve the detail that makes an item actionable — **reference the concrete files,
     symbols, and docs as inline code**. Do not use relative markdown links; they do not resolve from
     a Gitea issue body. This inline-code richness is a deliberate asset — carry it, do not flatten
     items to one vague line.
4. **Epic check.** Would this realistically decompose into **3+ separate issues**? If so, propose
   splitting it now, and — only then — propose a milestone to group the pieces (the lazy-milestone
   rule: a milestone with one issue is overhead). A single self-contained item stays one issue.
   When the pieces have dependencies, label each dependency-blocked issue `blocked` (not `someday`)
   with a strict `Blocked-by: #n[, #m...]` line in its body — anchored to the start of the line,
   comma-separated issue refs, nothing else on that line — so the promotion workflow can parse it.
   Optionally note in prose, in each blocker's own body, what it unblocks; that text is for a
   reader's context only and is never parsed.
5. **Confirm, then create.** Show the user the title, body, and labels before writing. Never invent
   scope the user did not describe.

## Creating and managing via the API

Auth and host come from your Gitea REST API reference (`GITEA_TOKEN`, the Gitea base URL). The repo
slug is in `AGENTS.md`; below, `$REPO` stands for that `owner/name`. Note issue creation takes label
**ids**, not names — resolve them first:

```bash
# Resolve label name → id
curl -s -H "Authorization: token $GITEA_TOKEN" "$BASE/api/v1/repos/$REPO/labels"

# Create an issue (labels is an array of ids). Write the JSON to a UTF-8 file and use
# --data-binary @file — inline -d mangles non-ASCII characters (see the API reference).
curl -s -H "Authorization: token $GITEA_TOKEN" -H "Content-Type: application/json" \
  -X POST "$BASE/api/v1/repos/$REPO/issues" --data-binary @issue.json
```

Managing existing items:

- **Start work:** the tracker's claim command (see `AGENTS.md`) — adds the `in-progress` label.
- **Reprioritize:** add or remove the `someday` label to move an item between the someday and next tiers.
- **Unblock:** automatic. When an issue closes, a Gitea Actions workflow checks every open `blocked`
  issue's `Blocked-by:` line and strips `blocked` from any whose referenced blockers are now all closed.
- **Complete:** do **not** close by hand. Reference the issue from the PR that finishes it —
  `Fixes #<n>` in the PR description — so the merge closes it. This binds completion to the merge, which
  is what makes parallel worktrees safe: no shared file to conflict on. A Gitea Actions workflow strips
  `in-progress`, `blocked`, and `someday` from the issue the moment it closes, and promotes dependents
  per the Unblock bullet above.

## Keep it lean

This is task tracking for a personal project, not an agile ceremony. Do the five authoring steps and
the management verbs above and stop — no estimates, sprints, or burndown. YAGNI applies to process as
much as to code.
