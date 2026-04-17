## New Worktree policy
- Keep `/Users/andresolave/Projects/velocity/verii` checked out on `main` as the primary worktree.
- Do not switch this worktree to feature branches. Create a new sibling worktree for any non-`main` branch work.
- Default Base branch: `origin/main`
- If user specifies target branch use `origin/<target-branch>`.
- Use branch names prefixed with `codex/` and place them in the parent directory.
- See [RELEASING.md](RELEASING.md) for the Verii release branching, versioning, tagging, and release-notes policy.

## JS/TS edits
- After modifying `.js` or `.ts` files, run `eslint --fix` on the affected files.

## pnpm workspace rules
- Use `corepack pnpm@10.30.2` for all dependency commands.
- After rebasing onto `origin/main` and no conflicts you can run:
  - `corepack pnpm@10.30.2 install --lockfile-only --no-frozen-lockfile`
