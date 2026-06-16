# Steps to run e2e tests

## Quickstart

1. Run docker compose `docker compose up`
1. Wait for the shared services, sample registrar, and credentialing hub containers to start.
1. When running the test set the environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0`
1. Run tests using `pnpm nx run @verii/server-credentialing-hub:test:e2e`

## Docker Compose

- Run docker compose using `docker compose up`
- Rebuild any broken container using `docker compose up --build --force-recreate --no-deps`
