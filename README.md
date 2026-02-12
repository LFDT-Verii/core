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
yarn install
yarn build
yarn test
yarn lint
```

## Package Publishing

- Package publishing is handled by GitHub Actions via `.github/workflows/publish-packages.workflow.yml`.
- The workflow installs `lerna` globally in CI and runs publish from there.
- The root repo does not rely on a local `lerna` dependency for publishing.
