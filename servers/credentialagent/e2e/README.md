# Steps to run e2e tests

## Quickstart

1. Run docker compose `docker compose -f ../docker/compose.yml up`
1. Set the `NODE_TLS_REJECT_UNAUTHORIZED` environment variable to `0`
1. Run tests using `pnpm exec nx run @verii/server-credentialagent:test:e2e`

## Docker Compose

- Run docker compose using `docker compose up`
- Rebuild any broken container using `docker compose up --build --force-recreate --no-deps`
