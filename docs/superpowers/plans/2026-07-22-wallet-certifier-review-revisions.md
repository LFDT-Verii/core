# Wallet Certifier Review Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the six Phase 1 review comments by aligning deployment with the engineering Terraform layers, tightening configuration and naming, accurately classifying browser tests, and isolating all persistence behind application-owned JavaScript/JSDoc repositories.

**Architecture:** The Wallet Certifier server will depend on three use-case-oriented repository contracts rather than a MongoDB `Db`. The Mongo adapter will centralize collection names, indexes, and named projections while retaining the native driver for transparent debugging. Engineering resources will move from the standalone `tf/22-wallet-certifier` root into modules owned by the existing secrets, webapps, Lambda, MongoDB, and BetterStack layers; no new numbered layer is required.

**Tech Stack:** Node.js 24, JavaScript/CommonJS, JSDoc, Fastify 5, native MongoDB driver 7, React 18, Playwright, Node test runner, Docker Compose, Terraform 1.5.1, AWS Lambda/API Gateway/S3/CloudFront/EventBridge/Secrets Manager, BetterStack.

## Global Constraints

- Keep `/Users/andresolave/Projects/velocity/verii` on `main`; edit the existing sibling worktrees only.
- Keep Phase 1 Mongo-only. Do not introduce Spence, an ORM, Postgres, or DynamoDB.
- Keep the Wallet Certifier server in JavaScript and express persistence contracts with JSDoc.
- Do not expose Mongo filters, update operators, projections, collections, or `Db` objects to controllers or services.
- Use integration tests through public HTTP endpoints for repository, orchestration, and validation behavior.
- Run `eslint --fix` on every changed JavaScript or JSX file.
- Treat Terraform as declarative configuration: verify it with `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate`; no Terraform unit-test harness exists in this repository.
- Do not amend existing commits. Add signed-off conventional commits.
- Devnet is `dev`; testnet is `staging`. Do not add Phase 1 production or QA deployment.

---

### Task 1: Root health route and environment-owned Foundation configuration

**Files:**
- Modify: `servers/wallet-certifier/test/config-wallets-controller.test.js`
- Modify: `servers/wallet-certifier/test/local-simulator.test.js`
- Modify: `servers/wallet-certifier/src/config.js`
- Modify: `servers/wallet-certifier/src/controllers/config-controller.js`
- Modify: `servers/wallet-certifier/src/build-server.js`
- Modify: `apps/wallet-certifier/src/App.jsx`
- Modify: `servers/wallet-certifier/docker/compose.yml`
- Modify: `servers/wallet-certifier/README.md`

**Interfaces:**
- Produces: `GET /api/` as the database-backed health endpoint and `GET /api/config` unchanged.
- Produces: required `SUPPORT_EMAIL` server configuration with environment-specific values supplied by `.localdev.env`, tests, and Terraform variables.

- [ ] **Step 1: Change the HTTP integration test to request `/api/` and add configuration tests showing `SUPPORT_EMAIL` is required rather than defaulted**

```js
const response = await api.inject({ method: 'GET', url: '/api/' });
expect(() => loadConfig(validEnvWithoutSupportEmail)).toThrow(
  'SUPPORT_EMAIL is required',
);
```

- [ ] **Step 2: Run the focused tests and verify they fail because `/api/` is absent and `SUPPORT_EMAIL` still defaults**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/config-wallets-controller.test.js
```

Expected: failures for the missing root route and missing required configuration behavior.

- [ ] **Step 3: Make the health route `/` inside the `/api` plugin and remove source defaults containing `velocitynetwork.foundation`**

```js
supportEmail: asRequired(env, 'SUPPORT_EMAIL'),
```

Keep Foundation URLs only in `.localdev.env`, integration fixtures, and engineering `dev.tfvars`/`staging.tfvars`. Set the React pre-fetch fallback registration URL to an empty string.

- [ ] **Step 4: Update Docker health checks, simulator assertions, and README commands to `/api/`**

- [ ] **Step 5: Run the focused server tests and React tests, then lint the changed JS/JSX files with fixes**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix servers/wallet-certifier/src/config.js servers/wallet-certifier/src/controllers/config-controller.js servers/wallet-certifier/src/build-server.js servers/wallet-certifier/test/config-wallets-controller.test.js servers/wallet-certifier/test/local-simulator.test.js apps/wallet-certifier/src/App.jsx
```

Expected: all selected tests pass and ESLint exits zero.

### Task 2: Rename support diagnostics and browser-functional tests

**Files:**
- Rename: `servers/wallet-certifier/src/services/support-run.js` to `servers/wallet-certifier/src/services/support-diagnostics.js`
- Modify: `servers/wallet-certifier/src/controllers/support-controller.js`
- Modify: `servers/wallet-certifier/src/controllers/runs-controller.js`
- Rename: `apps/wallet-certifier/e2e/wallet-certifier.e2e.test.js` to `apps/wallet-certifier/browser-functional/wallet-certifier.browser-functional.test.js`
- Modify: `apps/wallet-certifier/playwright.config.js`
- Modify: `apps/wallet-certifier/package.json`
- Modify: `servers/wallet-certifier/README.md`

**Interfaces:**
- Produces: `loadSupportDiagnostics(runId, repositories, existingRun?)` and `projectSupportDiagnostics(run, notifications)`.
- Preserves: existing `/api/support/runs/:runId` and browser `/support/runs/:runId` URLs.
- Produces: `test:browser-functional` for Playwright tests that use the local Hub/Registrar simulator.

- [ ] **Step 1: Update result-access integration imports/expectations and the package script to the desired diagnostics and browser-functional names**

- [ ] **Step 2: Run the focused result-access test and browser command and verify the old production exports/script names cause failure**

- [ ] **Step 3: Rename the service file and exported functions, update both controllers, and rename the Playwright folder/file/configuration**

```js
const loadSupportDiagnostics = async (runId, repositories, existingRun) => {
  // Load only the run and notification diagnostics exposed to support.
};
```

- [ ] **Step 4: Run result-access tests, list the Playwright tests with the renamed command, and lint all changed files**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test -- test/result-access.test.js
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test:browser-functional -- --list
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix servers/wallet-certifier/src/services/support-diagnostics.js servers/wallet-certifier/src/controllers/support-controller.js servers/wallet-certifier/src/controllers/runs-controller.js apps/wallet-certifier/playwright.config.js apps/wallet-certifier/browser-functional/wallet-certifier.browser-functional.test.js
```

Expected: result access passes and Playwright lists four browser-functional scenarios.

### Task 3: Introduce entity definitions and Mongo repository contracts

**Files:**
- Create: `servers/wallet-certifier/src/entities/certification-run.js`
- Create: `servers/wallet-certifier/src/entities/run-evidence.js`
- Create: `servers/wallet-certifier/src/entities/notification-job.js`
- Create: `servers/wallet-certifier/src/repositories/contracts.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/entities/certification-runs.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/entities/run-evidence.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/entities/notification-jobs.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/certification-runs-repository.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/run-evidence-repository.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/notification-jobs-repository.js`
- Create: `servers/wallet-certifier/src/repositories/mongodb/index.js`
- Delete: `servers/wallet-certifier/src/repositories/mongo.js`
- Modify: `servers/wallet-certifier/test/config-wallets-controller.test.js`
- Modify: `servers/wallet-certifier/test/runs-controller.test.js`

**Interfaces:**
- Produces: `initMongo(connectionString, databaseName) -> Promise<{ client, db, repositories }>`.
- Produces: `Repositories` JSDoc containing `certificationRuns`, `runEvidence`, `notificationJobs`, and `ping()`.
- Produces: entity configuration containing `collectionName`, `indexes`, `defaultProjection`, and named safe projections.

The certification-run contract must expose named operations for `create`, `removeByRunId`, `findByRunId`, `setHubResources`, `startInteraction`, `acquireLease`, `schedule`, `recordReconcileFailure`, `prepareDisclosure`, `complete`, and `findDue`. The evidence contract must expose `create`, `findByRunId`, `saveInteraction`, `saveIssuedCredential`, and `saveTerminalEvidence`. The notification contract must expose `enqueueOnce`, `acquireNext`, `markSent`, `markRetry`, and `findDiagnosticsByRunId`.

- [ ] **Step 1: Change public-endpoint integration setup to pass `repositories` into `buildServer` and retain raw `db` only for test setup/assertions**

```js
mongo = await initMongo(mongoConnectionString, databaseName);
api = await buildServer({
  config,
  repositories: mongo.repositories,
  registrarClient,
  hubClient,
});
```

- [ ] **Step 2: Run the focused tests and verify they fail because `buildServer` and services still require `db`**

- [ ] **Step 3: Add JSDoc domain entity and repository contract definitions without importing MongoDB types into the contracts**

```js
/**
 * @typedef {object} Repositories
 * @property {CertificationRunsRepository} certificationRuns
 * @property {RunEvidenceRepository} runEvidence
 * @property {NotificationJobsRepository} notificationJobs
 * @property {() => Promise<void>} ping
 */
```

- [ ] **Step 4: Add centralized Mongo entity configuration and initialization**

```js
const certificationRunsEntity = Object.freeze({
  collectionName: 'certificationRuns',
  defaultProjection: { _id: 0 },
  indexes: [
    { key: { runId: 1 }, name: 'runId_unique', unique: true },
    { key: { state: 1, nextCheckAt: 1, leaseUntil: 1 }, name: 'active_runs_due' },
    { key: { purgeAt: 1 }, name: 'runs_ttl', expireAfterSeconds: 0 },
  ],
});
```

- [ ] **Step 5: Implement the three native Mongo adapters using named operations and keep `.collection()`, Mongo filters, update operators, and projections entirely inside `repositories/mongodb`**

- [ ] **Step 6: Run the focused endpoint tests and verify repository initialization, index creation, run creation, and run starting pass**

- [ ] **Step 7: Lint the new repository/entity files with fixes**

### Task 4: Migrate all services and controllers from `db` to repositories

**Files:**
- Modify: `servers/wallet-certifier/src/build-server.js`
- Modify: `servers/wallet-certifier/src/standalone.js`
- Modify: `servers/wallet-certifier/src/lambda-api.js`
- Modify: `servers/wallet-certifier/src/lambda-monitor.js`
- Modify: every file in `servers/wallet-certifier/src/services/`
- Modify: `servers/wallet-certifier/src/controllers/config-controller.js`
- Modify: `servers/wallet-certifier/src/controllers/runs-controller.js`
- Modify: `servers/wallet-certifier/src/controllers/support-controller.js`
- Modify: all affected server integration tests

**Interfaces:**
- Consumes: `Repositories` from Task 3.
- Produces: controllers and services with no raw Mongo dependency.

- [ ] **Step 1: Convert issuance reconciliation tests to construct the server/monitor with `repositories`, then run them and observe failures at remaining `context.db` access**

- [ ] **Step 2: Replace run lookups, state transitions, leasing, scheduling, and terminal completion with `certificationRuns` named operations**

- [ ] **Step 3: Replace evidence reads/writes with `runEvidence` operations and notification delivery/diagnostics with `notificationJobs` operations**

- [ ] **Step 4: Convert verification, result-access, monitor, and local-simulator test setup to repositories, running each integration suite after its migration**

- [ ] **Step 5: Confirm no production controller/service imports MongoDB or contains `.collection(`, `$set`, `$inc`, `$push`, `$unset`, or `context.db`**

Run:

```bash
rg -n "context\.db|\.collection\(|\$(set|inc|push|unset)" servers/wallet-certifier/src/controllers servers/wallet-certifier/src/services
```

Expected: no matches.

- [ ] **Step 6: Run the complete server test suite and ESLint with fixes over every changed JS file**

### Task 5: Move Wallet Certifier Lambda infrastructure into layer 19

**Files:**
- Create: `tf/19-aws-lambdas/modules/wallet-certifier/main.tf`
- Create: `tf/19-aws-lambdas/modules/wallet-certifier/variables.tf`
- Create: `tf/19-aws-lambdas/modules/wallet-certifier/outputs.tf`
- Create: `tf/19-aws-lambdas/modules/wallet-certifier/versions.tf`
- Modify: `tf/19-aws-lambdas/main.tf`
- Modify: `tf/19-aws-lambdas/variables.tf`
- Create or modify: `tf/19-aws-lambdas/outputs.tf`
- Modify: `tf/19-aws-lambdas/dev.tfvars`
- Modify: `tf/19-aws-lambdas/staging.tfvars`
- Modify: `.github/workflows/deploy-lambdas.workflow.yml`

**Interfaces:**
- Consumes: the `WALLET_CERTIFIER_RUNTIME` secret ARN from Terraform layer 14 remote state, testnet VPC outputs, and the existing common alarms topic.
- Produces: API and monitor Lambda names, API Gateway endpoint, scheduled one-minute monitor, IAM permissions, log groups, and CloudWatch alarms.

- [ ] **Step 1: Move the API Lambda, monitor Lambda, HTTP API Gateway, scheduled EventBridge rule, IAM, logs, and alarms from `tf/22-wallet-certifier/main.tf` into a layer-19 module**

- [ ] **Step 2: Add dev/staging-only module configuration and pass non-secret tenant/service/environment settings through layer tfvars**

- [ ] **Step 3: Extend the Lambda deployment workflow to accept and verify a successful LFDT-Verii/core Wallet Certifier build run, download `wallet-certifier-lambda`, and stage the immutable ZIP before planning layer 19**

- [ ] **Step 4: Format and validate layer 19**

Run:

```bash
terraform -chdir=tf/19-aws-lambdas fmt -recursive
terraform -chdir=tf/19-aws-lambdas init -backend=false
terraform -chdir=tf/19-aws-lambdas validate
```

Expected: formatting is stable and validation succeeds.

### Task 6: Move the web application into layer 18 and monitor into layer 21

**Files:**
- Create: `tf/18-webapps/modules/wallet-certifier/main.tf`
- Create: `tf/18-webapps/modules/wallet-certifier/variables.tf`
- Create: `tf/18-webapps/modules/wallet-certifier/outputs.tf`
- Create: `tf/18-webapps/modules/wallet-certifier/versions.tf`
- Modify: `tf/18-webapps/main.tf`
- Modify: `tf/18-webapps/variables.tf`
- Modify: `tf/18-webapps/outputs.tf`
- Modify: `tf/18-webapps/dev.tfvars`
- Modify: `tf/18-webapps/staging.tfvars`
- Modify: `tf/21-betteruptime/dev.tfvars`
- Modify: `tf/21-betteruptime/staging.tfvars`
- Modify: `.github/workflows/apps-deploy.workflow.yml`

**Interfaces:**
- Consumes: the Wallet Certifier API endpoint from layer 19 remote state.
- Produces: private S3/CloudFront SPA delivery, `/api/*` API proxying, WAF, DNS, deployable bucket/distribution outputs, and BetterStack probes at the environment URL `/api/`.

- [ ] **Step 1: Move the S3, CloudFront, WAF, and DNS resources from layer 22 into a layer-18 module and wire its API origin from layer-19 remote state**

- [ ] **Step 2: Add devnet/testnet application configuration to `dev.tfvars` and `staging.tfvars`, retaining all `velocitynetwork.foundation` values only in these environment files**

- [ ] **Step 3: Add `Velocity Wallet Certifier` service probes for dev and staging to layer 21 using `https://<environment-host>/api/`**

- [ ] **Step 4: Extend the existing application artifact deployment workflow so it can download `wallet-certifier-app` from LFDT-Verii/core and deploy it to the layer-18 bucket**

- [ ] **Step 5: Format and validate layers 18 and 21**

Run:

```bash
terraform -chdir=tf/18-webapps fmt -recursive
terraform -chdir=tf/18-webapps init -backend=false
terraform -chdir=tf/18-webapps validate
terraform -chdir=tf/21-betteruptime fmt -recursive
terraform -chdir=tf/21-betteruptime init -backend=false
terraform -chdir=tf/21-betteruptime validate
```

Expected: all validation commands succeed.

### Task 7: Remove the standalone Terraform root and revise deployment documentation

**Files:**
- Delete: `tf/22-wallet-certifier/**`
- Delete: `.github/workflows/deploy-wallet-certifier.workflow.yml`
- Modify: `tf/18-webapps/README.md`
- Modify: `tf/19-aws-lambdas/README.md`
- Modify: `tf/21-betteruptime/README.md`
- Modify: `servers/wallet-certifier/README.md`

**Interfaces:**
- Produces: documented apply order of layer 14 secrets, layer 16 Mongo users, layer 19 Lambdas, layer 18 web application, layer 21 BetterStack, then application artifact deployment.

- [ ] **Step 1: Delete the layer-22 root and its dedicated all-in-one infrastructure workflow**

- [ ] **Step 2: Document the `WALLET_CERTIFIER_RUNTIME` JSON secret, required tenant/service variables, artifact workflow inputs, health URL, rollback, and smoke tests in the owning layer READMEs**

- [ ] **Step 3: Confirm no references to `tf/22-wallet-certifier`, `/api/health`, `test:e2e`, `supportRun`, or `support-run` remain outside historical design/plan documents**

Run:

```bash
rg -n "tf/22-wallet-certifier|/api/health|test:e2e|supportRun|support-run" . --glob '!docs/superpowers/plans/2026-07-21-*'
```

Expected: no active-code, workflow, or runbook matches.

### Task 8: Full verification, diff review, commits, and PR updates

**Files:**
- Verify all modified files in both worktrees.

**Interfaces:**
- Produces: fresh evidence that core behavior, browser-functional flows, build artifacts, Terraform configuration, and workflow YAML are valid.

- [ ] **Step 1: Start the existing Docker Compose environment and run complete core verification**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier lint
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app lint
corepack $(node -p "require('./package.json').packageManager") --filter @verii/server-wallet-certifier build:lambda
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app build:artifact
docker compose -f servers/wallet-certifier/docker/compose.yml up -d --build
corepack $(node -p "require('./package.json').packageManager") --filter @verii/wallet-certifier-app test:browser-functional
```

Expected: all commands pass and four Playwright browser-functional scenarios succeed.

- [ ] **Step 2: Run Terraform format checks, backend-free initialization, validation for layers 16, 18, 19, and 21, and actionlint for changed workflows**

- [ ] **Step 3: Review `git diff --check`, `git status`, and the complete branch diffs in both repositories against all six comments**

- [ ] **Step 4: Commit core and engineering changes separately using signed-off conventional commit messages without amending prior commits**

- [ ] **Step 5: Push both existing branches and report fresh PR/check status**

## Self-review

- Spec coverage: Tasks 5–7 address infrastructure layering and BetterStack; Task 1 addresses environment URLs and health; Task 2 addresses both names; Tasks 3–4 implement the approved repository pattern.
- Placeholder scan: every implementation step names its concrete files, behavior, and verification command.
- Type consistency: all services consume one `Repositories` aggregate; repository method names are defined once in Task 3 and reused in Task 4.
- Layer consistency: the existing secret and Atlas layers remain authoritative; Lambda/API resources belong to 19, static web delivery to 18, and monitoring to 21. No layer 22 replacement is introduced.
