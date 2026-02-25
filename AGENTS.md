## pnpm workspace rules
- Use `corepack pnpm@10.30.2` for all dependency commands.
- After rebasing onto `origin/main` and no conflicts you can run:
  - `corepack pnpm@10.30.2 install --lockfile-only --no-frozen-lockfile`
