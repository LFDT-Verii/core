# Notification Worker Phase 3 and 4 Gap Consolidation Plan

**Goal:** Keep the notification-webhook MVP small and reviewable: serial delivery, disabled-worker gating, integration delivery tests, and minimal embedded child lifecycle wiring.

**Execution status:** Implemented in the current working tree on 2026-07-06. No commits were created because the user did not request commits.

## Decisions

- MVP delivery is serial by implementation: one in-flight event per worker process.
- Do not expose `maxConcurrency` or `NOTIFICATIONS_WORKER_MAX_CONCURRENCY` in this PR.
- Track configurable bounded concurrency in GitHub issue #804. That follow-up PR should reintroduce the config/env surface together with bounded parallel delivery, backpressure, metrics, process-count guidance, rollout guidance, and tests.
- Notification enablement gates the polling loop. If `config.notifications.enabled !== true`, `startNotificationDeliveryWorker()` returns a stopped worker handle and never starts recursive polling.
- Delete `notification-worker.js`; it was only a wrapper around `start-notification-worker.js`.
- Embedded mode forks `start-notification-worker.js` directly and only handles basic Fastify lifecycle shutdown in this PR.
- Move embedded supervisor hardening to a separate follow-up PR. That PR should cover restart/backoff/throttling, child `error` handling policy, shutdown escalation, observability, and fake child/timer tests with explicit rationale.
- Do not add a `startProcess()` extraction just to unit-test orchestration with mocked starter functions.

## Test Strategy

- Unit tests only for pure notification domain/config logic, event matching, event builders, and HMAC header construction.
- Delivery-worker behavior is integration-tested with a real Fastify test server, real Mongo-backed `notification_events` repo, and a real local HTTP webhook receiver.
- Do not fake `repos.notification_events`, fake `fetch`, or assert against mocked log calls in delivery-worker tests.
- Enqueue behavior remains covered by existing VN API integration tests that call public endpoints and assert Mongo `notification_events` documents.
- Embedded-child wiring uses a real Fastify instance and lifecycle hooks. The only mocked dependency is `node:child_process.fork`, because spawning the full worker child in hook tests would be slow and brittle.

## Implemented Scope

- Remove concurrency config from notification config and env parsing.
- Keep `startNotificationDeliveryWorker()` disabled gating.
- Convert delivery-worker tests to integration style.
- Delete `servers/credentialinghub/src/notification-worker.js`.
- Make `servers/credentialinghub/src/start-notification-worker.js` directly executable.
- Point embedded-child mode at `start-notification-worker.js`.
- Keep embedded-child process handling to fork on ready and signal shutdown on close.
- Update operator docs to say MVP delivery is serial and issue #804 owns configurable concurrency.

## Deferred Scope

### Follow-Up PR 1: Configurable Concurrency

Owned by issue #804.

- Reintroduce `maxConcurrency` and `NOTIFICATIONS_WORKER_MAX_CONCURRENCY`.
- Implement bounded parallel delivery; do not add config without real behavior.
- Define the target operational model for CPU count, process count, per-process concurrency, I/O saturation, and backpressure.
- Add metrics and rollout guidance before allowing values greater than one.
- Add integration tests that prove bounded concurrency and shutdown semantics.

### Follow-Up PR 2: Embedded Supervisor Hardening

- Add restart/backoff/throttling for `embedded-child`.
- Decide and implement child `error` handling policy.
- Add shutdown escalation if graceful IPC shutdown does not complete.
- Keep supervisor state runtime-only; durable delivery recovery remains in Mongo.
- Use fake child processes and fake timers only in supervisor-specific tests, with the rationale documented in the test file.

## Verification Commands

Run after implementation:

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  servers/credentialinghub/src/config/config.js \
  servers/credentialinghub/src/entities/notifications/domain/notification-config.js \
  servers/credentialinghub/src/entities/notifications/orchestrators/start-notification-delivery-worker.js \
  servers/credentialinghub/src/start-embedded-notification-worker.js \
  servers/credentialinghub/src/start-notification-worker.js \
  servers/credentialinghub/test/notifications/notification-delivery-worker.test.js \
  servers/credentialinghub/test/notifications/notification-domain.test.js \
  servers/credentialinghub/test/notifications/notification-embedded-worker.test.js
```

```bash
NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks \
  --test-reporter=spec --test-reporter-destination=stdout \
  test/notifications/notification-domain.test.js \
  test/notifications/notification-delivery-worker.test.js \
  test/notifications/notification-embedded-worker.test.js
```

```bash
NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks \
  --test-reporter=spec --test-reporter-destination=stdout \
  'test/notifications/**/*.test.js'
```

```bash
NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks \
  --test-reporter=spec --test-reporter-destination=stdout \
  'test/vn-api/*.test.js'
```

```bash
git diff --check
```
