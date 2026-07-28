The shared task lifecycle for this repo. Every command this references (the work tracker, the gate,
dev servers) is defined in `AGENTS.md` → **Commands** — run *those*, whatever they are for this repo.
Any steps unique to this repo (regenerating artifacts, dogfooding, smoke-tests) are listed in
`AGENTS.md` → **Project-specific workflow steps**; do those in addition to these.

1. **Check the work tracker** (the list command in `AGENTS.md` → Commands): the open Gitea issues,
   grouped In Progress / Next / Blocked / Someday. Use the tracker's `details <n>` to read one in full
   and its `claim <n>` to claim it (adds the `in-progress` label). Create or triage items with the
   `issue-triage` skill. Put `Fixes #<n>` in the PR description so the issue closes when it merges.
2. **Read the orienting docs and the code before editing.** Start from `AGENTS.md` → Architecture Hub
   and read the architecture/requirements docs relevant to what you're touching. Inspect the existing
   implementation before changing it.
3. **Research and planning may happen directly on `main`.** Before any actual implementation begins,
   create a worktree on a new branch off `main` (`EnterWorktree`) — never implement directly on
   `main`. `main` is branch-protected; direct pushes are rejected by the server, not just discouraged.
   (If the repo runs a post-`EnterWorktree` hook to prepare the checkout, let it finish before working.)
4. **For any non-trivial implementation, use the feature team** (the `feature-team` skill). Skip it
   only when **every one** of the following holds, else use the team:
   - The change touches a single file.
   - Fewer than 20 lines of code are added or changed.
   - The logic is straightforward — not a complex algorithm, a sensitive invariant, or a tricky
     integration point.
   - At most one documentation update is needed.
5. **Preserve the architecture and phasing** described in this repo's requirements/architecture docs
   unless a redesign is explicitly requested.
6. **Update the affected docs** — this `AGENTS.md`, the relevant `docs/` pages, and `README.md` (plus
   any requirements/roadmap docs the repo keeps) — when behavior, architecture, commands, or
   conventions change.
7. **Do the repo-specific pre-completion steps** in `AGENTS.md` → Project-specific workflow steps
   (e.g. regenerating a manifest, dogfooding, an end-to-end smoke test), then **run the gate** (the
   gate command in `AGENTS.md` → Commands) before reporting completion.
8. **Push the branch and open a pull request against `main`.** `main` is protected and only the user
   merges into it, so implementation is not complete until the PR is open — never push to or merge
   `main` directly. Keep the branch rebased on `main` if the PR reports conflicts (`git rebase`, never
   merge `main` into the branch), resolve, re-run the gate, and force-push with `--force-with-lease`.
9. **Tear down anything you started** for the task that is still running — local dev/preview servers,
   background processes, and browser pages or instances opened for verification — so no orphaned
   servers or tools are left behind. Only what you launched locally; shared/CI-owned resources are not
   yours to stop (see `AGENTS.md` for any such exceptions).
10. **After the user merges the PR**, switch back to the main checkout, `git pull` to sync it with the
    merge, and clean up (remove) the worktree.
