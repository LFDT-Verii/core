## Worktree policy (default)
- First step on every new coding task: create a new git worktree.
- Exception: when continuing an existing PR branch you previously created, reuse its worktree/branch.
- Base branch: `origin/main` unless the user specifies a target branch.
- If the user specifies a target branch, base from `origin/<target-branch>`.
- Never edit files in the primary checkout; only edit inside the new worktree.
- Report the worktree path and branch name before making changes.
- Use branch names prefixed with `codex/`.

## JS/TS edits
- After modifying `.js` or `.ts` files, run `eslint --fix` on the affected files.
