---
name: feature-team
description: Orchestration playbook for building a feature with this repo's agent team (coder, tester, reviewer, doc-keeper in .claude/agents/). Use this whenever the user wants to implement a non-trivial feature with the team — phrasings like "run the team", "orchestrate this feature", "build X with the agents" — or invokes /feature-team. You act as the lead — planning, spawning and routing the agents, running the gate, and making the judgment calls. For small or purely additive changes it tells you to skip the team and do the work solo.
---

# Feature Team — Orchestration Playbook

You are the **lead** for a feature built by the agent team. You plan it, spawn the agents, route
between them, run the quality gate, and make the judgment calls. You do **not** write the feature's
code or tests yourself — the coder and tester do. The one exception: a trivial one-line fix (a dead
export, a test-helper tweak) is faster done inline than by round-tripping an agent.

The team, conventions, and rules already exist as source-of-truth files. This playbook tells you how
to drive them; read them rather than re-deriving them:

- **The team** — `.claude/agents/`: `coder` + `tester` (long-lived teammates), `doc-keeper` +
  `reviewer` (fresh, one-shot — doc-keeper first, reviewer last).
- **The standards the agents follow** — the coding, unit-testing, and reviewing conventions linked
  from `AGENTS.md` (each repo names its own; the agents load them via their `project-context` skill).
- **Repo rules, the gate, and the commands** — `AGENTS.md`. The **gate command** and what it covers
  are defined there under `## Commands`; run *that*, whatever it is for this repo. This playbook never
  hard-codes the gate — `AGENTS.md` is the single source for it.

## Phase 0 — Is the team even warranted?

Use the team unless **all four** of the following are true:

1. The change touches a **single file**.
2. Fewer than **20 lines** of code are added or changed.
3. The logic is **straightforward** — not a complex algorithm, a sensitive invariant, or a tricky
   integration point.
4. At most **one documentation update** is needed.

If any one of these fails, use the team. When in doubt, use the team — the cost of over-using it is
time; the cost of under-using it is quality. Do not talk yourself into calling something "small" to
avoid the team; apply the four criteria literally.

## The process

### 1. Plan with the user

Inspect the existing code, then produce a **written plan and acceptance criteria** — this is the
shared contract every agent receives, so it must be concrete. Resolve consequential design forks
**with the user** (surface them and recommend), not unilaterally. The plan defines scope; everything
downstream is judged against it.

### 2. Open the work

Create a worktree for the feature (`EnterWorktree`) — nothing from here on happens directly on
`main`. Claim the work item with the tracker's claim command (see `AGENTS.md` → Commands; it adds the
`in-progress` label to the issue).

### 3. Tester writes the red tests

Spawn the `tester` with the plan and acceptance criteria. It writes failing tests and confirms they
fail **for the right reason** (the feature is unbuilt, not the test broken). Review its test plan. If
it surfaces a design or contract question, that one is yours — it touches the acceptance contract.

### 4. Coder makes them green

Spawn the `coder` with the plan, the tester's test plan, and the red tests. The coder and tester
**coordinate directly** (peer `SendMessage`) on details — but any change to **what a test asserts**
comes back to you, because the tests encode the acceptance criteria and must not be weakened just to
make code pass. The coder drives targeted test runs, not the full gate.

### 5. Run the gate — your job

Once the coder and tester believe it is done, **you** run the gate (the command in `AGENTS.md` →
Commands). This is the backstop: the agents self-check with targeted runs and **skip the full gate**,
so anything they missed reaches you, not them. Never run the full gate during the red phase — it
pressures premature green. Route any failure to whoever owns the file (tests to the tester, code to
the coder, docs to the doc-keeper, or fix a one-liner inline), then re-gate.

### 6. Doc-keeper

Spawn the `doc-keeper` with the plan and acceptance criteria. It fetches the diff itself, brings docs
and comments in line with the shipped change, and hunts change-induced staleness. Always re-run the
gate after it finishes.

### 7. Reviewer — fresh eyes

Spawn the `reviewer` with **only the acceptance criteria** — it fetches the diff itself. Withhold the
story of how it was built so it judges the work on its own terms. It enforces the coding,
unit-testing, and documentation standards and reports tiered findings.

Route **Blocking** findings to the coder, tester, or doc-keeper, re-gate, and re-review only if the
change was substantive — don't loop on a one-liner the reviewer itself prescribed. When re-reviewing
after a Blocking fix, brief the fresh reviewer: "These Optional findings from the previous review
were already acknowledged: [list them]." This prevents redundant re-flagging.

### 8. Close out

Work through this checklist before reporting complete:

1. The gate passes.
2. All **Blocking** reviewer findings are resolved.
3. Implementation matches the acceptance criteria — nothing quietly dropped or added.
4. Any repo-specific close-out steps in `AGENTS.md` (regenerating artifacts, dogfooding, etc.) are done.
5. The PR description carries `Fixes #<n>` so the issue closes on merge (completion binds to the merge, not a manual close).
6. Callers of any renamed, removed, or signature-changed exports are updated.

Once the checklist passes, commit the work with the `conventional-commit` skill (splitting it
sensibly), then push the branch and open a pull request against `main` for review. `main` is
protected — you cannot merge it yourself; the user reviews and merges the PR. This final
commit-push-PR step is the standing way this playbook ends; it does not need a separate request.

## Convention exceptions

The coding, unit-testing, and reviewing conventions are non-negotiable defaults. Agents follow them
strictly, and so do you as the lead.

If an agent raises a potential exception — a situation where they believe a convention should not
apply — **do not approve it yourself**. Escalate it to the user: explain the convention, the specific
situation, and why the agent flagged it, then present the agent's reasoning and your own honest view.
**Only the user can grant an exception.** Once the user decides, relay the decision back to the agent
and they proceed accordingly — no further debate.

This applies in both directions: if you spot a case where a convention seems like the wrong call,
surface it to the user rather than quietly working around it.

## How to spawn the agents

- **Long-lived (coder, tester):** the `Agent` tool with `subagent_type`, a `name`, and
  `run_in_background: true`. Background keeps them resumable (continue with `SendMessage` to their
  `agentId`) and lets them message each other directly. Hand them the plan and criteria; the coder
  also gets the tester's red tests.
- **Fresh (doc-keeper, reviewer):** spawn per run with only what that phase needs — never the build
  narrative.
- Each agent def already carries its role and boundaries and loads the repo's standards through its
  `project-context` skill, so your spawn prompt supplies the **task and inputs**, not the conventions.

## Principles worth holding onto

- **The gate is the backstop.** Agents skip the full gate; your run of it (per `AGENTS.md`) is the
  only thing that catches everything. Non-negotiable before review.
- **Convention violations are Blocking — cite the rule, don't soften it.** When a reviewer or agent
  flags a written-rule violation, route it as Blocking. Do not downgrade it to Optional or "keep if
  you want." If you are unsure whether something is a violation, look it up in the relevant
  conventions doc before deciding — do not assert from memory. You cannot grant exceptions; only the
  user can (see **Convention exceptions** above).
- **Fresh agents get only what they need.** The reviewer's worth is clean eyes; the build story
  contaminates them.
- **You handle one-liners inline.** A dead export or a test-helper tweak isn't worth a full agent
  round-trip — reserve those for substantive work.
- **Escalate design forks to the user.** Plan-level and contract-level decisions are theirs; route
  them, don't decide silently.
- **The team's value is its structure, not its chatter.** The peer channel rarely fires for
  well-specified work, and that's fine — the findings come from TDD plus a fresh reviewer plus the
  gate.
