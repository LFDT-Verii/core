# Steps to run e2e tests

## Quickstart

1. From this directory, start the e2e stack:

   ```sh
   docker compose up -d --build
   ```

1. Wait for the shared services, sample registrar, and credentialing hub containers to start.
1. Confirm the blockchain contracts were deployed:

   ```sh
   docker compose logs contracts-deployment
   ```

   The contract addresses must match the values in `../.localdev.env`.
1. Confirm the sample registrar migrations completed:

   ```sh
   docker compose logs registrar-migrations
   ```

   The registrar migration seeds the credential types used by the e2e test.
1. From the repository root, run the e2e test:

   ```sh
   NODE_TLS_REJECT_UNAUTHORIZED=0 corepack $(node -p "require('./package.json').packageManager") nx run @verii/server-credentialing-hub:test:e2e
   ```

## Docker Compose

- Run docker compose using `docker compose up -d --build`
- Rebuild any broken container using `docker compose up -d --build --force-recreate --no-deps <service>`
- Stop the stack using `docker compose down -v --remove-orphans`

If startup fails because ports are already allocated, remove stale containers from older e2e stacks before starting again. The most common names are `e2e-besu`, `e2e-credentialinghub`, `e2e-registrar`, and `e2e-fineract-server-1`.

The Fineract image used by this stack is amd64-only. On arm64 Docker hosts, startup depends on amd64 emulation and may be significantly slower or fail to become healthy. If `fineract-probe` becomes unhealthy, check `docker compose logs fineract-server`; an amd64 runner is the most reliable way to run the full e2e stack.
