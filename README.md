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
- Keep the current override inventory in [docs/dependency-overrides.md](docs/dependency-overrides.md).
- Remove the resolution once the upstream dependency path resolves the patched version without the override.

## Package Publishing

- Package publishing is handled by Nx Release and GitHub Actions.
- Release groups are configured in `nx.json`.
- Next-minor prerelease builds publish automatically from `main` with the npm `prerelease` dist-tag.
- Release PRs are prepared by `.github/workflows/prepare-release.workflow.yml` from selected groups and a semver bump.
- Production release notes are checked in under `.github/releases/<group>-vX.Y.Z.md`.
- Manual prerelease and production exact-version publishes run through `.github/workflows/publish-packages.workflow.yml`.
- See [RELEASING.md](RELEASING.md) for release groups, release bumps, and promotion policy.
