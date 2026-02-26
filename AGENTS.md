## New Worktree policy
- Default Base branch: `origin/main`
- If user specifies target branch use `origin/<target-branch>`.
- Use branch names prefixed with `codex/` and place them in the parent directory.

## JS/TS edits
- After modifying `.js` or `.ts` files, run `eslint --fix` on the affected files.

## New JS/TS Dependencies
- Run `yarn install`

## JS/TS Dependency upgrades
- Run `yarn install --ignore-scripts`