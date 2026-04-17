# Verii Monorepo
![Github CI](https://github.com/LFDT-Verii/core/workflows/Node.js%20CI/badge.svg)
![Vulnerabilities](https://github.com/LFDT-Verii/core/workflows/Vulnerability%20Audit/badge.svg)
![Dependency License Check](https://github.com/LFDT-Verii/core/workflows/Dependency%20License%20Check/badge.svg)

Contains Verii's Core Components
- Common modules
- Registrar endpoints
- Credential agent
- Mock vendor

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Security Resolutions

- Prefer the narrowest possible `resolutions` entry for transitive security fixes.
- Scope overrides to the affected parent chain when feasible, such as `hardhat/mocha/serialize-javascript` for Hardhat-only remediation.
- Document each temporary resolution in `package.json` with the advisory or alert reference and the condition for removal.
- Remove the resolution once the upstream dependency path resolves the patched version without the override.

## Package Publishing

- Package publishing is handled by GitHub Actions via `.github/workflows/publish-packages.workflow.yml`.
- `VERSION` is the committed source of truth for the next Verii release version.
- Release notes live in `.github/releases/vX.Y.Z.md`.
- See [RELEASING.md](RELEASING.md) for the release-branch and prod-release workflow.
- The workflow installs `lerna` globally in CI and runs publish from there.
- The root repo does not rely on a local `lerna` dependency for publishing.
