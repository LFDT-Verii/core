# Wallet Certifier

Wallet Certifier is the phase-one Velocity Network Foundation application for testing wallet issuing and verification support. The React app uses the Fastify API; MongoDB stores run state/evidence/jobs; Credentialing Hub performs the protocol interactions; and SES sends applicant and support result links.

Phase one supports `VN_API`. OpenID-only wallets remain visible but disabled. OpenID4VCI/OpenID4VP, multi-CAO Hub tokens, and PDF reports are phase two.

## Run the complete local environment

The compose file includes the repository's existing shared MongoDB 8 and LocalStack services and adds the app, API, scheduled monitor, and deterministic Registrar/Credentialing Hub simulator.

```bash
VELOCITY_MONGO_PORT=17018 docker compose -f servers/wallet-certifier/docker/compose.yml up --build -d
```

The dedicated Mongo port keeps this stack runnable alongside the Credentialing Hub compose project. Override `VELOCITY_MONGO_PORT` if `17018` is also in use.

Open:

- App: <http://localhost:14080>
- API health: <http://localhost:14081/api/health>
- Interactive dependency simulator: <http://localhost:14082/health>
- MongoDB: `mongodb://localhost:17018/wallet_certifier_local`
- LocalStack: <http://localhost:14566>

Search for `velocity`, select **Velocity Test Wallet**, and begin a certification. The automatically opened local wallet tab exposes the applicable deterministic actions:

- issuing: accept, reject, or raise an exchange error;
- verification disclosure: share the exact setup badge, share without it, or raise an exchange error.

The monitor runs every five seconds. It reconciles due runs and sends queued applicant/support mail through LocalStack SES. Its JSON summaries are visible with:

```bash
docker compose -f servers/wallet-certifier/docker/compose.yml logs -f wallet-certifier-monitor
```

Run the full browser suite against the stack:

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test:e2e
```

Inspect a sanitized support record (production protects this route with API Gateway IAM authorization):

```bash
curl http://localhost:14081/api/support/runs/RUN_ID
```

Stop and remove local data:

```bash
VELOCITY_MONGO_PORT=17018 docker compose -f servers/wallet-certifier/docker/compose.yml down -v
```

## Run packages without Docker

Start MongoDB on `localhost:27017`, export the values from `.localdev.env` with downstream URLs changed to `http://localhost:14082`, then run:

```bash
node servers/wallet-certifier/local/mock-dependencies.mjs
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier start:dev
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app dev
```

## Tests

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
```

The server integration tests use a real MongoDB instance. Pure deadline, capability, badge, and result rules use unit tests.

## Runtime entry points

- API Lambda: `src/lambda-api.handler`
- EventBridge monitor Lambda: `src/lambda-monitor.handler`
- Local API server: `src/standalone.js`

Configuration comes from environment variables; secrets can be loaded from `WALLET_CERTIFIER_SECRETS_ARN`. The Hub tenant and issuer/relying-party service IDs are server configuration and cannot be selected by the browser.
