## Coverage Summary Local Tests

Run locally from the repo root:

```bash
yarn test:coverage-summary-local
```

What this validates:
- Relative `SF:` paths are mapped back to the owning package when coverage reports are downloaded from multiple artifacts.
- Per-package totals only include `src/**` files.
- PR summary logic computes diff coverage and fails when below threshold.
- The summary step passes gracefully when no coverage reports are present.
