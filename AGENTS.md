## New Worktree policy
- Default Base branch: `origin/main`
- If user specifies target branch use `origin/<target-branch>`.
- Use branch names prefixed with `codex/` and place them in the parent directory.

## JS/TS edits
- After modifying `.js` or `.ts` files, run `eslint --fix` on the affected files.

## pnpm workspace rules
- Use `corepack pnpm@10.30.2` for all dependency commands.
- After rebasing onto `origin/main` and no conflicts you can run:
  - `corepack pnpm@10.30.2 install --lockfile-only --no-frozen-lockfile`
