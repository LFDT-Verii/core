# Wallet Certifier Phase One Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the phase-one Wallet Certifier React application, Fastify/Lambda API, Credentialing Hub exchange inspection endpoint, local Mongo/LocalStack environment, and deployable build artifacts in `LFDT-Verii/core`.

**Architecture:** A React 18/Vite SPA calls a Fastify 5 API through API Gateway. MongoDB is authoritative; browser status reads and a one-minute scheduled Lambda invoke the same leased, idempotent reconciler. Credentialing Hub is polled through its operator APIs, and SES notification jobs are stored in Mongo. The app and API can run locally against the repository's shared Mongo/LocalStack compose services and an interactive mock Registrar/Hub.

**Tech Stack:** Node.js 24, JavaScript/CommonJS server, React 18/JSX, Vite/SWC, React Router 7, MUI/Emotion, Fastify 5, `@fastify/aws-lambda`, MongoDB 8, SES, Node test runner, Testing Library, Playwright, Docker Compose.

## Global Constraints

- Phase one supports VN_API only; OpenID-only wallets are visible but disabled.
- Use the existing global Credentialing Hub operator token and a server-configured VNF tenant.
- Each wallet interaction has a 10-minute action deadline and a 15-minute absolute deadline.
- Verification must contain the exact setup badge; all additional credentials must pass applicable checks.
- Applicant and support emails are created for every terminal outcome and contain links, never raw evidence.
- Result links expire after seven days; sensitive live data after 30 days; sanitized summaries after 12 months.
- Raw evidence, PII, capabilities, and protocol tokens must never enter logs.
- Pure domain logic receives unit tests; validation, adapters, and orchestration receive integration tests through public endpoints.
- Use `corepack $(node -p "require('./package.json').packageManager")` for dependency commands.
- Run ESLint with `--fix` after every JavaScript change set.
- Use signed conventional commits; never amend.

---

## File map

### Workspace and CI

- Modify `pnpm-workspace.yaml` to include `apps/*`.
- Modify `.github/workflows/node-ci.workflow.yml` so app dependencies and reports participate in caching and CI.
- Modify `eng/docker/Dockerfile-NodeE2E` to copy `apps/` for local builds.
- Create `.github/workflows/build-wallet-certifier.workflow.yml` to publish app and Lambda artifacts.

### Credentialing Hub

- Create `servers/credentialinghub/src/controllers/operator/exchanges/exchanges-controller.js` for safe exchange inspection.
- Create `servers/credentialinghub/src/controllers/operator/exchanges/schemas/exchange.schema.js` for the response contract.
- Modify `servers/credentialinghub/src/entities/exchanges/repo/repo.js` only if the safe projection needs additional persisted fields.
- Create `servers/credentialinghub/test/operator/exchanges-controller.test.js` for public endpoint integration coverage.

### Wallet Certifier server

- Create `servers/wallet-certifier/package.json`, ESLint config, local/test env files, and README.
- Create `servers/wallet-certifier/src/config.js` for validated non-secret configuration and secret loading.
- Create `servers/wallet-certifier/src/build-server.js`, `standalone.js`, `lambda-api.js`, and `lambda-monitor.js` for runtime entry points.
- Create focused modules under `src/domain/`, `src/adapters/`, `src/repositories/`, `src/services/`, and `src/controllers/`.
- Create public-endpoint integration tests under `servers/wallet-certifier/test/` and pure unit tests under `servers/wallet-certifier/test/domain/`.

### Wallet Certifier app

- Create `apps/wallet-certifier/package.json`, Vite/ESLint/test/Playwright configuration, and `index.html`.
- Create route, API, theme, page, and component modules under `apps/wallet-certifier/src/`.
- Create Testing Library tests next to features and Playwright tests under `apps/wallet-certifier/e2e/`.

### Local environment

- Create `servers/wallet-certifier/docker/compose.yml` by including `eng/docker/services/shared-compose.yml`.
- Create `servers/wallet-certifier/local/mock-dependencies.mjs` for interactive local wallet acceptance/rejection.
- Create `servers/wallet-certifier/local/init-localstack.sh` for SES identity setup.
- Document exact startup and scenario commands in `servers/wallet-certifier/README.md`.

---

### Task 1: Workspace, package, and CI foundations

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `.github/workflows/node-ci.workflow.yml`
- Modify: `eng/docker/Dockerfile-NodeE2E`
- Create: `apps/wallet-certifier/package.json`
- Create: `apps/wallet-certifier/vite.config.js`
- Create: `apps/wallet-certifier/eslint.config.mjs`
- Create: `apps/wallet-certifier/setup-tests.js`
- Create: `apps/wallet-certifier/index.html`
- Create: `apps/wallet-certifier/src/main.jsx`
- Create: `apps/wallet-certifier/src/App.jsx`
- Create: `apps/wallet-certifier/src/App.test.jsx`
- Create: `servers/wallet-certifier/package.json`
- Create: `servers/wallet-certifier/eslint.config.mjs`

**Interfaces:**

- Produces workspace projects `@verii/wallet-certifier-app` and `@verii/server-wallet-certifier`.
- Produces app scripts `dev`, `build`, `test`, `test:ci`, `lint`, and `lint:fix`.
- Produces server scripts `start`, `start:dev`, `test`, `test:ci`, `lint`, and `lint:fix`.

- [x] **Step 1: Add a failing React render test**

```jsx
import { test } from "node:test";
import { expect } from "expect";
import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

test("renders the wallet certifier heading", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /wallet certifier/i }),
  ).toBeTruthy();
});
```

- [x] **Step 2: Run the test and verify the workspace does not yet know the app**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test`

Expected: FAIL because the package is not in the workspace.

- [x] **Step 3: Add `apps/*`, package manifests, Vite/SWC, React 18, Router 7, MUI/Emotion, React Hook Form, Testing Library, Playwright, Fastify 5, MongoDB, SES client, and Lambda adapter dependencies**

The minimal initial app implementation is:

```jsx
const App = () => <h1>Wallet Certifier</h1>;

export default App;
```

The server package must be private and expose `src/standalone.js` as `start`, with Node 24 engine metadata.

- [x] **Step 4: Update CI cache/report globs and the local Node Docker build to include `apps/*`**

Add `apps/*/node_modules`, `apps/*/eslint-results.json`, `apps/*/test-results.junit.xml`, and `apps/*/lcov.info` alongside the existing server/package paths. Add `COPY --chown=node:node apps ./apps` to the builder image.

- [x] **Step 5: Install and run the two package smoke checks**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") install --no-frozen-lockfile
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app build
```

Expected: one passing render test and a successful Vite build.

- [x] **Step 6: Fix lint and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app lint:fix
git add pnpm-workspace.yaml pnpm-lock.yaml .github/workflows/node-ci.workflow.yml eng/docker/Dockerfile-NodeE2E apps/wallet-certifier servers/wallet-certifier/package.json servers/wallet-certifier/eslint.config.mjs
git commit -s -m "feat(wallet-certifier): add workspace foundations"
```

### Task 2: Credentialing Hub safe exchange inspection

**Files:**

- Create: `servers/credentialinghub/src/controllers/operator/exchanges/schemas/exchange.schema.js`
- Create: `servers/credentialinghub/src/controllers/operator/exchanges/exchanges-controller.js`
- Test: `servers/credentialinghub/test/operator/exchanges-controller.test.js`

**Interfaces:**

- Produces `GET /operator/exchanges/get?tenantId=<id>&exchangeId=<id>`.
- Produces `GET /operator/exchanges/get?tenantId=<id>&depotId=<id>`.
- Returns `{ exchange: { id, depotId, serviceId, type, protocol, state, events, error, credentialIds, presentationIds, createdAt }, requestId }`.

- [x] **Step 1: Write endpoint integration tests**

Cover missing filters, both filters supplied, tenant isolation, direct exchange lookup, latest VN_API depot lookup, not found, presentation/credential references, and error sanitization. The sanitization expectation is:

```js
expect(response.json.exchange.error).toEqual({
  code: "unexpected_error",
  message: "The exchange ended unexpectedly.",
});
expect(JSON.stringify(response.json)).not.toContain("database password");
```

- [x] **Step 2: Run the focused Hub test and verify 404/failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub test -- test/operator/exchanges-controller.test.js`

Expected: FAIL because the route is absent.

- [x] **Step 3: Implement the schema and controller**

Use exactly one of `exchangeId` and `depotId`. Derive safe errors from the latest failure state:

```js
const SAFE_ERRORS = {
  AUTHENTICATION_FAILURE: {
    code: "authentication_failure",
    message: "Wallet authentication failed.",
  },
  CLIENT_ERROR: {
    code: "client_error",
    message: "The wallet reported a protocol error.",
  },
  UNEXPECTED_ERROR: {
    code: "unexpected_error",
    message: "The exchange ended unexpectedly.",
  },
};
```

Never return `exchange.err` or protocol message bodies.

- [x] **Step 4: Run Hub tests and lint**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub lint:fix
```

Expected: all Credentialing Hub tests pass.

- [x] **Step 5: Commit**

```bash
git add servers/credentialinghub
git commit -s -m "feat(credentialinghub): expose safe exchange inspection"
```

### Task 3: Pure Wallet Certifier domain model

**Files:**

- Create: `servers/wallet-certifier/src/domain/states.js`
- Create: `servers/wallet-certifier/src/domain/deadlines.js`
- Create: `servers/wallet-certifier/src/domain/capabilities.js`
- Create: `servers/wallet-certifier/src/domain/evidence.js`
- Create: `servers/wallet-certifier/src/domain/results.js`
- Create: `servers/wallet-certifier/src/domain/badge.js`
- Test: `servers/wallet-certifier/test/domain/*.test.js`

**Interfaces:**

- Produces `newDeadlines(startedAt)`, `classifyDeadline(run, exchange, now)`, `hashCapability(token, pepper)`, `fingerprintJwt(jwt)`, `evaluateVerification(input)`, and `buildSetupBadge(input)`.

- [x] **Step 1: Write unit tests for every state/deadline/result rule**

The exact-badge pass case must resemble:

```js
expect(
  evaluateVerification({
    presentation: { verified: true },
    setupFingerprint: fingerprintJwt("setup.jwt"),
    credentials: [
      { jwt: "setup.jwt", verified: true, checks: { tamper: "PASS" } },
      { jwt: "other.jwt", verified: true, checks: { expiry: "PASS" } },
    ],
  }),
).toEqual({ passed: true, setupBadgePresent: true });
```

Add failing cases for missing setup badge, failed presentation, a failed setup check, and a failed additional credential.

- [x] **Step 2: Run domain tests and verify failures**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/domain`

Expected: FAIL because domain modules are absent.

- [x] **Step 3: Implement immutable pure functions**

`newDeadlines(startedAt)` returns ISO timestamps exactly 10 and 15 minutes after `startedAt`. `buildSetupBadge` emits Open Badges 3.0 `AchievementSubject` content with the applicant email represented as an `IdentityObject`, the applicant and wallet names in the achievement, and no log side effects.

- [x] **Step 4: Run tests, fix lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/domain
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier/src/domain servers/wallet-certifier/test/domain
git commit -s -m "feat(wallet-certifier): add certification domain rules"
```

### Task 4: Fastify API, Mongo repositories, configuration, and wallet search

**Files:**

- Create: `servers/wallet-certifier/src/config.js`
- Create: `servers/wallet-certifier/src/build-server.js`
- Create: `servers/wallet-certifier/src/standalone.js`
- Create: `servers/wallet-certifier/src/lambda-api.js`
- Create: `servers/wallet-certifier/src/adapters/registrar-client.js`
- Create: `servers/wallet-certifier/src/adapters/secret-loader.js`
- Create: `servers/wallet-certifier/src/repositories/mongo.js`
- Create: `servers/wallet-certifier/src/controllers/config-controller.js`
- Create: `servers/wallet-certifier/src/controllers/wallets-controller.js`
- Test: `servers/wallet-certifier/test/config-wallets-controller.test.js`

**Interfaces:**

- Produces `buildServer({ config, db, registrarClient, hubClient, sendEmail, now })`.
- Produces `GET /api/config`, `GET /api/health`, and `GET /api/wallets?q=`.
- Produces `initMongo(connectionString, databaseName)` with warm-process connection reuse and index creation.

- [x] **Step 1: Write public endpoint integration tests with a real test Mongo database and stub Registrar HTTP server**

Verify bounded search, mapped wallet fields, VN/dual eligibility, OpenID-only disabled reason, Registrar failure mapping, security headers, and that logs omit query email-like data.

- [x] **Step 2: Run the focused test and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/config-wallets-controller.test.js`

Expected: FAIL because `buildServer` is absent.

- [x] **Step 3: Implement Fastify and repositories**

Fastify must be created with redacted logging and explicit schemas:

```js
const server = Fastify({
  logger: {
    level: config.logSeverity,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
    ],
  },
  bodyLimit: config.bodyLimit,
});
```

Create unique/index/TTL indexes for run IDs, due active runs, evidence purge, and notification job IDs. Cache `MongoClient` at module scope; do not close it after each Lambda invocation.

- [x] **Step 4: Run test, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/config-wallets-controller.test.js
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier
git commit -s -m "feat(wallet-certifier): add API and wallet search"
```

### Task 5: Run creation and wallet-interaction start

**Files:**

- Create: `servers/wallet-certifier/src/adapters/hub-client.js`
- Create: `servers/wallet-certifier/src/services/create-run.js`
- Create: `servers/wallet-certifier/src/services/start-run.js`
- Create: `servers/wallet-certifier/src/controllers/runs-controller.js`
- Test: `servers/wallet-certifier/test/runs-controller.test.js`

**Interfaces:**

- Produces `POST /api/runs` and `POST /api/runs/:runId/start`.
- Produces Hub client methods `createDepot`, `createCredential`, `refreshIssueLink`, `getCredential`, `refreshPresentationLink`, `getPresentations`, `verifyPresentation`, and `getExchange`.

- [x] **Step 1: Write endpoint integration tests**

Cover validation, server-side wallet revalidation, capability hashing, no PII in `certificationRuns`, PII in expiring `runEvidence`, issuing setup, verification setup, idempotent repeated start, wrong/expired capability, and VN-only redirect construction.

The redirect assertion must verify:

```js
const redirect = new URL(response.json.redirectUrl);
expect(redirect.searchParams.get("wallet")).toEqual(wallet.id);
expect(redirect.searchParams.get("deeplink")).toEqual(
  "velocity-network-devnet://issue",
);
expect(redirect.searchParams.has("openid4vc_uri")).toBe(false);
```

- [x] **Step 2: Run tests and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/runs-controller.test.js`

Expected: FAIL because the run routes are absent.

- [x] **Step 3: Implement create/start orchestration**

Create the depot, badge, credential, and issue link in order. Persist each returned Hub identifier with conditional updates. Return the interaction token only at initial creation and never store it in plaintext.

- [x] **Step 4: Run tests, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/runs-controller.test.js
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier
git commit -s -m "feat(wallet-certifier): create and start certification runs"
```

### Task 6: Issuance reconciliation, terminal results, and notifications

**Files:**

- Create: `servers/wallet-certifier/src/services/reconcile-run.js`
- Create: `servers/wallet-certifier/src/services/terminal-result.js`
- Create: `servers/wallet-certifier/src/services/process-notifications.js`
- Create: `servers/wallet-certifier/src/adapters/email-sender.js`
- Modify: `servers/wallet-certifier/src/controllers/runs-controller.js`
- Test: `servers/wallet-certifier/test/issuance-reconciliation.test.js`

**Interfaces:**

- Produces `reconcileRun(runId, context)` and `processNotificationJobs(context)`.
- `GET /api/runs/:runId` performs a due reconciliation and returns applicant-safe progress/result.

- [x] **Step 1: Write endpoint integration tests for pending, issued, rejected, exchange error, 10-minute inactivity, 15-minute finalization, transient Hub retry, concurrent GETs, and terminal immutability**

Verify two deterministic notification jobs on every terminal outcome and no raw JWT in those jobs' rendered email bodies.

- [x] **Step 2: Run and observe failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/issuance-reconciliation.test.js`

Expected: FAIL because reconciliation is absent.

- [x] **Step 3: Implement leased reconciliation and terminal transaction ordering**

Use `findOneAndUpdate` with `revision`, active state, `nextCheckAt`, and an expired/missing lease. Store raw issued JSON/JWT in a 30-day evidence document, store only SHA-256 fingerprints and summaries on the run, commit the terminal state, then upsert applicant/support notification jobs.

- [x] **Step 4: Implement SES delivery with deterministic job leases**

Use `@verii/aws-clients.initSendEmailNotification`. With a local AWS endpoint, it automatically selects SES v1 supported by LocalStack. Record SES message ID, attempt count, last safe error code, and next attempt.

- [x] **Step 5: Run tests, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/issuance-reconciliation.test.js
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier
git commit -s -m "feat(wallet-certifier): reconcile issuance and notify results"
```

### Task 7: Verification setup, disclosure, and exact-badge evaluation

**Files:**

- Modify: `servers/wallet-certifier/src/services/start-run.js`
- Modify: `servers/wallet-certifier/src/services/reconcile-run.js`
- Modify: `servers/wallet-certifier/src/services/terminal-result.js`
- Test: `servers/wallet-certifier/test/verification-reconciliation.test.js`

**Interfaces:**

- Extends `POST /api/runs/:runId/start` to start disclosure after setup issuance.
- Extends `GET /api/runs/:runId` to return presentation and per-credential results.

- [x] **Step 1: Write integration tests for the complete verification workflow**

Cover setup pending/success/reject/error/timeout, disclosure pending/error/timeout, presentation pass/fail, exact setup badge present/absent, failed setup credential, failed additional credential, and multiple passing credentials.

- [x] **Step 2: Run and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/verification-reconciliation.test.js`

Expected: FAIL at disclosure start/reconciliation.

- [x] **Step 3: Implement disclosure and verification orchestration**

After setup success, retain the issued JWT fingerprint, move to `PREPARING_DISCLOSURE`, and wait for an explicit start call. On presentation receipt, call Hub verification once per presentation ID, map its top-level and credential checks, fingerprint every disclosed JWT, and call `evaluateVerification`.

- [x] **Step 4: Run tests, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/verification-reconciliation.test.js
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier
git commit -s -m "feat(wallet-certifier): certify credential verification"
```

### Task 8: Result sessions, support diagnostics, and scheduled handler

**Files:**

- Create: `servers/wallet-certifier/src/controllers/result-sessions-controller.js`
- Create: `servers/wallet-certifier/src/controllers/support-controller.js`
- Create: `servers/wallet-certifier/src/services/monitor-runs.js`
- Create: `servers/wallet-certifier/src/lambda-monitor.js`
- Test: `servers/wallet-certifier/test/result-access.test.js`
- Test: `servers/wallet-certifier/test/monitor-handler.test.js`

**Interfaces:**

- Produces `POST /api/result-sessions`, `GET /api/support/runs/:runId`, and `handler(event)` for EventBridge.

- [x] **Step 1: Write integration tests for capability exchange and result cookies**

Assert applicant/support role separation, seven-day expiry, fragment token never appears in logs, `Secure`/`HttpOnly`/`SameSite=Strict` production cookies, and redacted support output.

- [x] **Step 2: Write monitor integration tests**

Insert due active runs and pending notification jobs, invoke the handler, and assert leased reconciliation/delivery. Insert non-due and terminal runs and assert they are untouched.

- [x] **Step 3: Run tests and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/result-access.test.js test/monitor-handler.test.js`

Expected: FAIL because routes/handler are absent.

- [x] **Step 4: Implement session cookie, support projection, and monitor**

The support projection includes identifiers, state, counters, safe errors, journal, and email status only. The monitor processes a bounded batch and returns `{ reconciled, notificationsProcessed, failures }` without throwing the entire batch for one run.

- [x] **Step 5: Run the complete server suite, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint:fix
git add servers/wallet-certifier
git commit -s -m "feat(wallet-certifier): secure results and scheduled monitoring"
```

### Task 9: Trust Ledger setup journey

**Files:**

- Create: `apps/wallet-certifier/src/theme.js`
- Create: `apps/wallet-certifier/src/api.js`
- Create: `apps/wallet-certifier/src/components/AppShell.jsx`
- Create: `apps/wallet-certifier/src/components/StepRail.jsx`
- Create: `apps/wallet-certifier/src/components/StatusDot.jsx`
- Create: `apps/wallet-certifier/src/pages/SetupPage.jsx`
- Modify: `apps/wallet-certifier/src/App.jsx`
- Test: `apps/wallet-certifier/src/pages/SetupPage.test.jsx`

**Interfaces:**

- Produces `/` setup route and API methods `searchWallets`, `createRun`, `startRun`, `getRun`, and `createResultSession`.

- [x] **Step 1: Write Testing Library tests for wallet search, VN eligibility, OpenID disabled state, registration prompt, name/email validation, and capability selection**

Use role/name assertions and keyboard interaction; do not assert implementation-specific MUI class names.

- [x] **Step 2: Run tests and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test -- src/pages/SetupPage.test.jsx`

Expected: FAIL because the page is absent.

- [x] **Step 3: Implement the Trust Ledger setup page**

Use the approved warm paper palette, `#0d0d0c` text, restrained ledger rules, typographic VNF wordmark fallback, responsive dossier rail, accessible form controls, and no generic card grid. Open a blank wallet tab synchronously from the final start click before awaiting API responses.

- [x] **Step 4: Run tests/build, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app build
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app lint:fix
git add apps/wallet-certifier
git commit -s -m "feat(wallet-certifier): build Trust Ledger setup journey"
```

### Task 10: Waiting, result, and emailed-link journeys

**Files:**

- Create: `apps/wallet-certifier/src/pages/WaitingPage.jsx`
- Create: `apps/wallet-certifier/src/pages/ResultPage.jsx`
- Create: `apps/wallet-certifier/src/pages/ResultLinkPage.jsx`
- Create: `apps/wallet-certifier/src/components/EvidenceSection.jsx`
- Create: `apps/wallet-certifier/src/components/CheckList.jsx`
- Create: `apps/wallet-certifier/src/hooks/useRunPolling.js`
- Test: `apps/wallet-certifier/src/pages/WaitingPage.test.jsx`
- Test: `apps/wallet-certifier/src/pages/ResultPage.test.jsx`
- Test: `apps/wallet-certifier/src/pages/ResultLinkPage.test.jsx`

**Interfaces:**

- Produces `/runs/:runId`, `/results/:runId`, and result-fragment exchange behavior.

- [x] **Step 1: Write UI tests**

Cover countdown, do-not-close copy, QR/link fallback, disclosure continue action, all terminal failure copy, presentation verified dot, exactly one dot per verified status, inline JSON/JWT, per-check icons/text, result-link fragment removal, and new-test navigation.

- [x] **Step 2: Run and verify failure**

Run: `corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test -- src/pages`

Expected: FAIL because pages are absent.

- [x] **Step 3: Implement pages and polling**

Poll active runs every three seconds while visible and every fifteen seconds while hidden. Stop on terminal state. Announce state changes through an `aria-live` region. Render one bright-green `StatusDot` for success; never combine it with a pseudo-element marker.

- [x] **Step 4: Run tests/build/lint and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app build
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app lint:fix
git add apps/wallet-certifier
git commit -s -m "feat(wallet-certifier): add waiting and result journeys"
```

### Task 11: Local Mongo, LocalStack, and interactive dependency mocks

**Files:**

- Create: `servers/wallet-certifier/docker/compose.yml`
- Create: `servers/wallet-certifier/local/mock-dependencies.mjs`
- Create: `servers/wallet-certifier/local/init-localstack.sh`
- Create: `servers/wallet-certifier/.localdev.env`
- Create: `servers/wallet-certifier/README.md`
- Create: `apps/wallet-certifier/playwright.config.js`
- Create: `apps/wallet-certifier/e2e/wallet-certifier.e2e.test.js`

**Interfaces:**

- Produces `VELOCITY_MONGO_PORT=17018 docker compose -f servers/wallet-certifier/docker/compose.yml up --build -d`.
- Exposes app `http://localhost:14080`, API `http://localhost:14081`, mock dependencies `http://localhost:14082`, Mongo `localhost:17018`, and LocalStack `localhost:14566`.

- [x] **Step 1: Write Playwright success/failure flows against deterministic mocks**

Cover issuing accepted/rejected, verification with exact setup badge, verification missing setup badge, QR fallback, and result rendering.

- [x] **Step 2: Create the compose stack by including the existing shared services**

Override Mongo and LocalStack with health checks, run an SES initialization container, and start app/API/mock services only after dependencies are healthy. Use local-only test values and never commit real secrets.

- [x] **Step 3: Implement the dependency mock**

The mock Registrar returns VN, dual, and OpenID-only wallets. The mock Hub implements only the operator routes used by Wallet Certifier plus an interactive `/app-redirect` page with Accept, Reject, Exchange error, and Share without setup badge actions.

- [x] **Step 4: Start the stack and run browser tests**

```bash
VELOCITY_MONGO_PORT=17018 docker compose -f servers/wallet-certifier/docker/compose.yml up --build -d
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test:e2e
VELOCITY_MONGO_PORT=17018 docker compose -f servers/wallet-certifier/docker/compose.yml down -v
```

Expected: all services healthy and Playwright flows pass.

- [x] **Step 5: Commit**

```bash
git add servers/wallet-certifier apps/wallet-certifier eng/docker/Dockerfile-NodeE2E
git commit -s -m "test(wallet-certifier): add local integration environment"
```

### Task 12: Build artifacts and final core verification

**Files:**

- Create: `.github/workflows/build-wallet-certifier.workflow.yml`
- Modify: `servers/wallet-certifier/package.json`
- Modify: `apps/wallet-certifier/package.json`
- Modify: `docs/superpowers/plans/2026-07-21-wallet-certifier-phase-1-core.md`

**Interfaces:**

- Produces artifacts `wallet-certifier-app.zip` and `wallet-certifier-lambda.zip` from a workflow dispatch/run.
- Lambda ZIP contains both `src/lambda-api.handler` and `src/lambda-monitor.handler` entry points.

- [x] **Step 1: Add artifact build scripts and workflow**

The workflow checks out the repository, installs with the lockfile, runs app/server/Hub tests and lint, builds the SPA, creates a production server deployment with pnpm deploy, zips both outputs, and uploads named artifacts.

- [x] **Step 2: Build artifacts locally and inspect their contents**

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app build
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier build:lambda
unzip -l apps/wallet-certifier/dist/wallet-certifier-app.zip
unzip -l servers/wallet-certifier/dist/wallet-certifier-lambda.zip
```

Expected: app contains `index.html` and hashed assets; Lambda contains both handlers and production dependencies.

- [x] **Step 3: Run full affected verification**

```bash
corepack $(node -p "require('./package.json').packageManager") lint:fix:affected --base=origin/main --head=HEAD
corepack $(node -p "require('./package.json').packageManager") lint:affected --base=origin/main --head=HEAD
corepack $(node -p "require('./package.json').packageManager") test:affected --base=origin/main --head=HEAD
corepack $(node -p "require('./package.json').packageManager") build:affected --base=origin/main --head=HEAD
git diff --check origin/main...HEAD
```

Expected: all affected lint, test, and build targets pass with no whitespace errors.

- [x] **Step 4: Update plan checkboxes, commit final workflow/docs, and prepare PR evidence**

```bash
git add .github/workflows/build-wallet-certifier.workflow.yml apps/wallet-certifier servers/wallet-certifier docs/superpowers/plans
git commit -s -m "ci(wallet-certifier): publish deployment artifacts"
```
