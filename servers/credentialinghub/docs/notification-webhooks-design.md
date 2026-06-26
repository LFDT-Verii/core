# Credentialing Hub Notification Webhooks Design

## Purpose

Credentialing Hub needs an operator-facing notification system that can call webhooks when important depot events occur. The first target receiver is the same system operator that runs the hub, normally inside the operator LAN. The design must still be robust enough to support small single-container deployments and larger deployments where webhook delivery runs separately from the API.

This document is an implementation specification for future agents. It is not an API contract freeze; the implementation should keep payload `version` fields and internal mapping functions explicit so payloads can evolve safely.

## Goals

- Notify configured operator systems when selected depot-related events occur.
- Keep wallet-facing and operator-facing request paths fast and resilient.
- Prevent webhook receiver outages from breaking credential or presentation flows.
- Support single-container small deployments and split API/worker deployments with the same code and image.
- Provide an event model that can extend from depot presentation/issuing events to authentication and future events.
- Provide enough delivery auditability for operators to diagnose failed webhook delivery.
- Keep secrets out of payloads and logs.

## Non-Goals

- Do not implement a public event bus or multi-tenant marketplace webhook product in the first release.
- Do not reuse wallet push-delegate `messagingSettings` for operator notifications.
- Do not send full VP JWTs, VC JWTs, or credential content by default.
- Do not make webhook delivery a hard dependency of issuing or presentation flows.
- Do not require external queue infrastructure for the initial implementation.

## Current Code Context

Relevant current hub paths:

- Presentations are received and persisted in `servers/credentialinghub/src/entities/exchanges/orchestrators/post-presentation.js`.
- Credentials are approved, issued, rejected, and finalized in `servers/credentialinghub/src/entities/exchanges/orchestrators/issue-credentials.js`.
- Exchange state transitions are stored through `servers/credentialinghub/src/entities/exchanges/repo/exchange-state-repo-extension.js`.
- Exchange state names live in `servers/credentialinghub/src/entities/exchanges/domain/exchange-states.js`.
- Existing `messagingSettings` and `webhookUrl` fields are wallet push-delegate state, not operator notifications.
- OpenID4VCI wallet notifications are handled in `servers/credentialinghub/src/entities/openid4vci/orchestrators/handle-notification.js`; those are inbound wallet protocol notifications and should remain separate from outbound operator webhooks.

## Recommended Architecture

Use a Mongo-backed outbox with an async delivery worker.

Flow:

1. A hub request performs the normal domain write, such as storing a presentation or marking a credential issued.
2. The request inserts one or more notification outbox events into Mongo.
3. A notification worker claims due events using an atomic lease.
4. The worker POSTs signed webhook requests to the configured endpoint.
5. The worker marks each event `delivered`, `retrying`, or `dead`.

Webhook delivery must never happen directly inside wallet-facing request handlers.

## Deployment Modes

Use the same Docker image and code paths for all modes.

Environment option:

```text
NOTIFICATIONS_WORKER_MODE=embedded-child | standalone | disabled
```

Modes:

- `embedded-child`: API process starts normally and forks a notification worker child process. This is the default small-deployer mode.
- `standalone`: process runs only the notification worker. This is the scalable deployment mode.
- `disabled`: API process does not start a notification worker. Use when a separate worker deployment exists or notifications are disabled.

Rationale:

- A forked child process is better isolated than an in-process `setTimeout` loop.
- A child crash should not crash the Fastify API process.
- A standalone worker should use the same Mongo leasing and delivery code.

Implementation choice:

- Use Node's built-in `child_process.fork()` for `embedded-child` mode.
- Do not use PM2 or another external process manager.
- Do not use Node `worker_threads`; webhook delivery is I/O-bound and process isolation is more useful than shared-memory threading.
- Do not add a process-supervisor library unless `child_process.fork()` proves insufficient.
- Cockatiel may be used for retry, backoff, timeout, circuit-breaker, or bulkhead policies in the delivery worker, but it should not own child process supervision.

## Configuration

### MVP: Static Operator Webhook Config

The first implementation should use static runtime configuration. This fits the current target: one operator-controlled receiver inside the operator LAN.

Suggested config shape:

```json
{
  "notifications": {
    "enabled": true,
    "workerMode": "embedded-child",
    "retentionDays": 30,
    "webhook": {
      "url": "https://operator-lan.example/internal/credentialing-hub/events",
      "eventTypes": [
        "depot.presentation.received",
        "depot.credential.issued",
        "depot.credential.rejected"
      ],
      "secret": "env-or-kms-secret",
      "signatureHeaderName": "Verii-Signature",
      "timeoutMs": 5000,
      "maxAttempts": 12,
      "maxConcurrency": 4
    }
  }
}
```

Implementation notes:

- Load the secret from env/config/KMS according to existing config conventions.
- Do not expose the secret through operator APIs or logs.
- Validate `url` at startup when notifications are enabled.
- For MVP, support exactly one webhook destination.
- Allow `eventTypes` to include exact event types and wildcard suffixes like `depot.credential.*`.
- Retain terminal events for 30 days by default so operators can inspect recent product events and support future operational recovery features.
- Apply retention to the `notification_events` collection, not to a specific receiver.

Suggested env variables:

```text
NOTIFICATIONS_ENABLED=true
NOTIFICATIONS_WORKER_MODE=embedded-child
NOTIFICATIONS_WEBHOOK_URL=https://operator-lan.example/internal/credentialing-hub/events
NOTIFICATIONS_WEBHOOK_EVENTS=depot.presentation.received,depot.credential.issued,depot.credential.rejected
NOTIFICATIONS_WEBHOOK_SECRET=...
NOTIFICATIONS_WEBHOOK_TIMEOUT_MS=5000
NOTIFICATIONS_WORKER_MAX_CONCURRENCY=4
NOTIFICATIONS_MAX_ATTEMPTS=12
NOTIFICATIONS_RETENTION_DAYS=30
```

### Runtime-Managed Subscriptions

Do not build stored subscriptions in MVP. Runtime-managed destinations are tracked as a future extension in [Future Extensions](#future-extensions).

## Event Model

Expose curated product events, not raw exchange states.

Initial event types:

```text
depot.presentation.received
depot.credential.issued
depot.credential.rejected
```

Future event types are tracked in [Future Extensions](#future-extensions).

Event naming rules:

- Use dot-separated lowercase names.
- Use past-tense facts.
- Keep event names independent of internal exchange state names.
- Include `version` on every event.
- Use one event per resource where practical.

### Common Payload Shape

```json
{
  "id": "evt_01J...",
  "type": "depot.credential.issued",
  "version": 1,
  "occurredAt": "2026-06-25T10:15:30.000Z",
  "tenantId": "65...",
  "tenantDid": "did:web:example.com",
  "serviceId": "65...",
  "depotId": "65...",
  "exchangeId": "65...",
  "resource": {
    "type": "credential",
    "id": "65..."
  },
  "data": {},
  "links": {}
}
```

Field rules:

- `id`: globally unique event id. Use `nanoid` or another existing local id utility.
- `type`: event type string.
- `version`: integer payload version for this event type.
- `occurredAt`: time the domain event occurred, not time delivered.
- `tenantId`, `serviceId`, `depotId`, `exchangeId`: string ids when available.
- `tenantDid`: useful for operator correlation.
- `resource`: the primary resource this event is about.
- `data`: event-specific safe summary fields.
- `links`: optional operator API paths for fetching details.

Do not include:

- Full VP JWT.
- Full VC JWT.
- Credential subject data.
- Raw credential content.
- Auth tokens.
- HMAC secrets.

### Presentation Received

Emit after the presentation is verified, validated, and inserted.

Event type:

```text
depot.presentation.received
```

Payload example:

```json
{
  "id": "evt_01J...",
  "type": "depot.presentation.received",
  "version": 1,
  "occurredAt": "2026-06-25T10:15:30.000Z",
  "tenantId": "tenant-id",
  "tenantDid": "did:web:issuer.example",
  "serviceId": "service-id",
  "depotId": "depot-id",
  "exchangeId": "exchange-id",
  "resource": {
    "type": "presentation",
    "id": "presentation-id"
  },
  "data": {
    "format": "JWT_VP",
    "verificationStatus": "received"
  },
  "links": {
    "presentation": "/operator/presentations/get?tenantId=tenant-id&presentationId=presentation-id"
  }
}
```

Emission point:

- `postPresentation()` after `repos.presentations.insert(...)` succeeds.

### Credential Issued

Emit once per issued credential after the credential record has `did`, `digestSRI`, and `acceptedAt`.

Event type:

```text
depot.credential.issued
```

Payload example:

```json
{
  "id": "evt_01J...",
  "type": "depot.credential.issued",
  "version": 1,
  "occurredAt": "2026-06-25T10:15:30.000Z",
  "tenantId": "tenant-id",
  "tenantDid": "did:web:issuer.example",
  "serviceId": "service-id",
  "depotId": "depot-id",
  "exchangeId": "exchange-id",
  "resource": {
    "type": "credential",
    "id": "credential-id"
  },
  "data": {
    "credentialDid": "did:velocity:...",
    "credentialReference": "employee-123-degree",
    "credentialTypes": ["EducationDegree"],
    "digestSRI": "sha384-..."
  },
  "links": {
    "credential": "/operator/credentials/get?tenantId=tenant-id&credentialId=credential-id"
  }
}
```

Emission point:

- `issueCredentials()` after `issueApprovedCredentials(...)` returns updated issued credentials.

### Credential Rejected

Emit once per rejected credential after `rejectedAt` is set.

Event type:

```text
depot.credential.rejected
```

Payload example:

```json
{
  "id": "evt_01J...",
  "type": "depot.credential.rejected",
  "version": 1,
  "occurredAt": "2026-06-25T10:15:30.000Z",
  "tenantId": "tenant-id",
  "tenantDid": "did:web:issuer.example",
  "serviceId": "service-id",
  "depotId": "depot-id",
  "exchangeId": "exchange-id",
  "resource": {
    "type": "credential",
    "id": "credential-id"
  },
  "data": {
    "credentialReference": "employee-123-degree",
    "credentialTypes": ["EducationDegree"],
    "rejectionReason": "Credential source data did not pass verification",
    "rejectedAt": "2026-06-25T10:15:30.000Z"
  },
  "links": {
    "credential": "/operator/credentials/get?tenantId=tenant-id&credentialId=credential-id"
  }
}
```

Emission point:

- `issueCredentials()` after `rejectCredentials(...)` returns updated rejected credentials.

Rejected reason rule:

- Include `data.rejectionReason` only when a sanitized, operator-safe reason is available.
- Do not include raw validation output, credential subject data, or upstream error bodies.

## Outbox Data Model

Collection:

```text
notification_events
```

Document shape:

```json
{
  "_id": "evt_01J...",
  "type": "depot.credential.issued",
  "version": 1,
  "payload": {},
  "status": "pending",
  "attempts": 0,
  "nextAttemptAt": "2026-06-25T10:15:30.000Z",
  "lockedBy": null,
  "lockedUntil": null,
  "lastError": null,
  "createdAt": "2026-06-25T10:15:30.000Z",
  "updatedAt": "2026-06-25T10:15:30.000Z",
  "deliveredAt": null,
  "deadAt": null,
  "retentionExpiresAt": null
}
```

Statuses:

```text
pending
delivering
retrying
delivered
dead
```

Indexes:

```js
db.notification_events.createIndex(
  { status: 1, nextAttemptAt: 1, lockedUntil: 1, createdAt: 1 },
  { name: 'notification_events_due_idx' }
);

db.notification_events.createIndex(
  { type: 1, createdAt: -1 },
  { name: 'notification_events_type_created_idx' }
);

db.notification_events.createIndex(
  { status: 1, updatedAt: -1 },
  { name: 'notification_events_status_updated_idx' }
);

db.notification_events.createIndex(
  { retentionExpiresAt: 1 },
  {
    name: 'notification_events_retention_ttl_idx',
    expireAfterSeconds: 0
  }
);
```

Idempotency:

- Event `_id` is the webhook idempotency key.
- Receiver must tolerate duplicate deliveries of the same `Verii-Event-Id`.
- Worker must not try to guarantee exactly-once delivery.

Retention:

- Retain terminal events, including payloads, for 30 days by default.
- Make retention configurable through `NOTIFICATIONS_RETENTION_DAYS`.
- Set `retentionExpiresAt` when an event reaches `delivered` or `dead`.
- Leave `retentionExpiresAt` null while an event is `pending`, `delivering`, or `retrying`.

## Event Creation

Add a small notification domain module, for example:

```text
servers/credentialinghub/src/entities/notifications/
  domain/
    event-types.js
    build-notification-event.js
    should-emit-event.js
  repo/
    repo.js
  orchestrators/
    enqueue-notification-events.js
```

Creation rules:

- Only enqueue events after the domain write succeeds.
- If notifications are disabled, skip event creation.
- If the event type is not configured, skip event creation.
- If enqueue fails after the domain write succeeds, log an error with enough context and do not fail the user-facing request.
- Keep enqueue failures visible through logs and status metrics.

Atomicity note:

- A true transactional outbox would insert domain write and event write in one Mongo transaction.
- Existing code does not appear to consistently use Mongo transactions.
- For MVP, insert the outbox event immediately after the domain write and accept the small risk of notification loss if the process dies between writes.
- If notification loss becomes unacceptable, use the [Transactional Outbox](#transactional-outbox) extension.

## Worker Claiming

Worker must claim due events with an atomic lease.

Claim logic:

```js
const now = new Date();
const lockUntil = new Date(now.getTime() + lockDurationMs);

const result = await collection.findOneAndUpdate(
  {
    status: { $in: ['pending', 'retrying', 'delivering'] },
    nextAttemptAt: { $lte: now },
    $or: [
      { lockedUntil: { $exists: false } },
      { lockedUntil: null },
      { lockedUntil: { $lt: now } }
    ]
  },
  {
    $set: {
      status: 'delivering',
      lockedBy: workerId,
      lockedUntil: lockUntil,
      updatedAt: now
    },
    $inc: { attempts: 1 }
  },
  {
    sort: { createdAt: 1 },
    returnDocument: 'after'
  }
);
```

Multiple worker processes are safe because only one process can claim a document at a time.
An event already marked `delivering` is claimable only after its lock expires, which lets workers recover events left behind by a crashed delivery attempt.

## Delivery Rules

HTTP method:

```text
POST
```

Content type:

```text
application/json
```

Successful delivery:

```text
2xx
```

Retryable failures:

```text
network error
timeout
408
425
429
5xx
```

Permanent failures:

```text
400
401
403
404
405
409
410
415
422
other non-retryable 4xx
```

Permanent failures should mark the event `dead`, not block later events.

Timeout:

- Use `AbortController`.
- Default timeout: 5 seconds.
- Make timeout configurable.

Concurrency:

- Default max concurrency: 4.
- Make configurable.
- Do not start unbounded parallel deliveries.

Backoff:

- Exponential backoff with jitter.
- Default max attempts: 12.
- Example schedule: 15s, 30s, 1m, 2m, 5m, 10m, 20m, 40m, 1h, 2h, 4h, 8h.
- Cap maximum delay.

Dead letter behavior:

- If `attempts >= maxAttempts`, mark `dead`.
- Store `deadAt`, `lastError`, status code if available, and short response body excerpt if safe.
- Do not store secrets or full sensitive payloads in error fields.

## Webhook Security

### MVP Required Security

Even inside the operator LAN, use:

- HTTPS.
- URL allowlist or explicit configured URL.
- HMAC payload signature.
- Timestamped signatures with replay window.
- Event idempotency key.
- Sensitive payload minimization.

### Signature Headers

Send:

```text
Verii-Event-Id: evt_01J...
Verii-Event-Type: depot.credential.issued
Verii-Event-Time: 2026-06-25T10:15:30.000Z
Verii-Signature: t=1792913730,v1=<hex-hmac-sha256>
```

Signature input:

```text
${timestamp}.${rawBody}
```

Signature algorithm:

```text
HMAC-SHA256
```

Receiver verification:

1. Parse `t` and `v1` from `Verii-Signature`.
2. Reject if timestamp is outside the replay window.
3. Compute HMAC over `t.rawBody`.
4. Constant-time compare to `v1`.
5. Deduplicate by `Verii-Event-Id`.

Default replay window:

```text
5 minutes
```

### Optional Higher Security

HMAC is sufficient for the first LAN-targeted release. Do not make mTLS first-class in MVP.

mTLS and other authentication hardening options are tracked in [Future Extensions](#future-extensions).

### SSRF and Network Guardrails

When the URL is statically configured, validate at startup:

- Protocol is `https:` unless a local development override is enabled.
- Host is not empty.
- URL does not include username/password.

For stored subscriptions later, use the stronger validation listed in [Stored Subscriptions](#stored-subscriptions).

For the current LAN use case, private ranges may be expected, so make private-range allowance explicit in config.

## Process Isolation

### Embedded Child Mode

API process:

- Starts Fastify normally.
- Forks notification worker child with `child_process.fork()` when `NOTIFICATIONS_WORKER_MODE=embedded-child`.
- Logs child lifecycle.
- Restarts child with backoff on crash.
- Does not mark API readiness failed just because the worker is down.

Restart backoff:

```text
1s, 5s, 30s, then cap at 5m
```

Crash throttling:

- If too many crashes occur in a rolling window, stop restarting temporarily.
- Expose worker state through operator status.

Suggested child state:

```json
{
  "mode": "embedded-child",
  "state": "running",
  "pid": 12345,
  "lastStartedAt": "...",
  "lastExitedAt": null,
  "restartCount": 0,
  "lastExit": null
}
```

### Standalone Mode

Worker process:

- Initializes the same config, Mongo connection, and logging stack as the API.
- Does not start Fastify routes.
- Starts the same delivery loop.
- Exits non-zero only on unrecoverable startup errors.

## Graceful Shutdown

API process:

- On `SIGTERM`, stop accepting requests through the existing Fastify shutdown path.
- Send shutdown message to embedded child.
- After a grace period, kill child if it has not exited.

Worker process:

- Stop polling new events.
- Let active deliveries finish until `shutdownGraceMs`.
- Release or let leases expire for unfinished events.
- Close Mongo connection.

## Operator Status and Operations

Add operator-facing status endpoints once the worker exists.

Suggested endpoints:

```text
GET /operator/notifications/status
```

Manual replay is a useful extension, but it is not part of the core MVP.

Status response:

```json
{
  "enabled": true,
  "worker": {
    "mode": "embedded-child",
    "state": "running",
    "pid": 12345,
    "lastHeartbeatAt": "2026-06-25T10:15:30.000Z"
  },
  "queue": {
    "pending": 10,
    "retrying": 2,
    "delivering": 1,
    "deliveredLast24h": 52,
    "dead": 0,
    "oldestPendingCreatedAt": "2026-06-25T10:10:30.000Z"
  }
}
```

Health separation:

- Keep normal API health/readiness focused on API and database availability.
- Do not fail API readiness because webhook delivery is degraded.
- Expose notification health separately for operators.

## Implementation Plan

### Phase 1: Domain Event and Outbox Foundation

1. Add notification config parsing and validation.
2. Add `notifications` entity module with event types and builders.
3. Add `notification_events` repo and indexes.
4. Add pure helper functions:
   - event type matching.
   - payload builders.
   - HMAC header generation.
   - backoff calculation.
5. Add unit tests for pure helpers.

Acceptance:

- Config validates enabled/disabled modes.
- Event builders produce stable payloads with no full VP/VC payloads.
- Outbox repo can insert and claim events atomically.

### Phase 2: Event Emission from Existing Flows

1. Emit `depot.presentation.received` from `postPresentation()`.
2. Emit `depot.credential.issued` from `issueCredentials()` for each issued credential.
3. Emit `depot.credential.rejected` from `issueCredentials()` for each rejected credential.
4. Ensure enqueue failures are logged but do not fail the API request.
5. Add integration tests from public-facing endpoints:
   - `POST /r/:tenantId/presentation`.
   - `POST /r/:tenantId/issue-credentials`.

Acceptance:

- Existing successful flows still return the same responses.
- Matching events appear in `notification_events`.
- Disabled notifications create no events.
- Event type filtering works.
- Enqueue failure does not break the endpoint.

### Phase 3: Worker Delivery

1. Add worker loop that claims due events.
2. Add delivery client using `fetch` and `AbortController`.
3. Add HMAC signing headers.
4. Add retry/dead-letter logic.
5. Add bounded concurrency.
6. Add graceful shutdown.
7. Add integration tests against local mocked webhook receiver.

Acceptance:

- 2xx marks delivered.
- Retryable failure schedules retry.
- Permanent failure marks dead.
- Timeout is handled.
- Multiple workers do not deliver the same claimed event concurrently.
- Duplicate delivery remains possible after lease expiry, and this is documented.

### Phase 4: Process Modes

1. Add worker standalone entrypoint.
2. Add API embedded-child supervisor using `child_process.fork()`.
3. Add mode config:
   - `embedded-child`
   - `standalone`
   - `disabled`
4. Add child restart backoff and crash throttling.
5. Add process-level tests where practical, or focused integration tests for supervisor behavior.

Acceptance:

- `embedded-child` starts worker child with API.
- Child crash does not crash API.
- Child restarts with backoff.
- `standalone` starts only the worker loop.
- `disabled` starts no worker.

### Phase 5: Operator Visibility

1. Add queue status aggregation.
2. Add `/operator/notifications/status`.
3. Add integration tests for operator status endpoint.

Acceptance:

- Operators can see worker state and queue depth.
- API readiness is independent of worker health.

## Testing Strategy

Follow the project instruction:

- Pure logic gets unit tests.
- Orchestration, adapters, and validation get integration tests from public-facing endpoints.

Unit tests:

- `shouldEmitEvent()` exact and wildcard matching.
- HMAC signature generation.
- Constant-time verification helper if included for test receiver utilities.
- Backoff with jitter bounds.
- Event payload builders.

Integration tests:

- Presentation endpoint enqueues `depot.presentation.received`.
- Issuing endpoint enqueues `depot.credential.issued`.
- Issuing endpoint enqueues `depot.credential.rejected`.
- Notifications disabled means no outbox insert.
- Worker delivers event to mocked HTTP server.
- Worker retries 500/429/timeouts.
- Worker marks 400/401/404 dead.
- Worker claim logic prevents concurrent claim by multiple workers.
- Embedded child crash does not fail an API health request.

Security tests:

- Signature header includes event id, type, timestamp, and HMAC.
- Different body produces different signature.
- Unsafe URL config fails startup when notifications are enabled.
- Payloads do not contain raw `jwtVc`, `presentation`, or `content`.

Run `eslint --fix` on changed `.js` files after implementation.

## Observability

Logs:

- Event enqueued.
- Delivery attempt started.
- Delivery succeeded.
- Delivery failed with status/error class.
- Event marked dead.
- Worker child start/exit/restart.

Metrics, if a metrics pattern exists:

- `notifications_events_enqueued_total`
- `notifications_delivery_attempts_total`
- `notifications_delivery_success_total`
- `notifications_delivery_failure_total`
- `notifications_events_dead_total`
- `notifications_queue_depth`
- `notifications_oldest_pending_age_seconds`

Log safety:

- Do not log HMAC secrets.
- Do not log full webhook payload at info level.
- Do not log full VP/VC data.
- Limit stored response body excerpts for failed deliveries.

## Product and API Semantics

Delivery guarantee:

```text
At-least-once delivery for events successfully inserted into the outbox.
```

Ordering:

- Best-effort by `createdAt`.
- Do not promise strict global ordering.
- Receivers should use event timestamps and ids.

Failure behavior:

- Webhook receiver outage does not fail issuing or presentation flows.
- Outbox insert failure does not fail issuing or presentation flows, including regulated deployments, but it must be logged and visible.
- Worker outage causes events to queue until worker recovers.

Receiver expectations:

- Return any 2xx to acknowledge.
- Deduplicate using `Verii-Event-Id`.
- Verify `Verii-Signature`.
- Fetch full details from operator APIs when needed.

## Future Extensions

| Extension | Trigger | Details |
| --- | --- | --- |
| Authentication events | Operators need webhook notifications for depot authentication outcomes. | [Authentication Events](#authentication-events) |
| Stored subscriptions | Operators need multiple destinations, runtime changes, scoped filters, or per-destination status. | [Stored Subscriptions](#stored-subscriptions) |
| mTLS hardening | Webhooks leave the LAN or operators require certificate-backed endpoint identity. | [mTLS Hardening](#mtls-hardening) |
| Manual replay | Operators need to redeliver retained events after receiver recovery or downstream reconciliation. | [Manual Replay](#manual-replay) |
| Payload expansion | Receivers need more product context than the v1 safe summaries provide. | [Payload Expansion](#payload-expansion) |
| Alternative queue backend | Mongo polling and leasing no longer satisfy throughput or isolation needs. | [Alternative Queue Backend](#alternative-queue-backend) |
| Transactional outbox | Notification loss between domain write and outbox insert becomes unacceptable. | [Transactional Outbox](#transactional-outbox) |

### Authentication Events

- Emit `depot.authentication.succeeded` after `AUTHENTICATION_SUCCESS`.
- Emit `depot.authentication.failed` from exchange error paths for supported failure states.

### Stored Subscriptions

When runtime management is needed, add operator endpoints and a `notification_subscriptions` collection.

Subscription fields:

- `id`
- `tenantId` optional
- `serviceId` optional
- `url`
- `eventTypes`
- `enabled`
- `auth.type`
- `auth.secret`
- `createdAt`
- `updatedAt`

Subscription capabilities:

- Multiple webhook destinations.
- Tenant/service/depot scoped filters.
- Secret rotation.
- Per-subscription delivery status.
- Add stronger SSRF protections.
- Deny link-local, metadata, loopback, multicast, and private ranges unless explicitly allowed by config.
- Consider DNS rebinding protections by resolving and validating IPs at delivery time.

Do not build stored subscriptions until there is a concrete requirement for multiple destinations or runtime changes.

### mTLS Hardening

Add mTLS when:

- Webhooks leave the operator LAN.
- The operator already manages internal client certificates.
- Strong endpoint identity is required.

Bearer tokens alone may be supported for compatibility later, but HMAC should remain the default because it proves payload integrity and is simple to operate.

### Manual Replay

- Add `POST /operator/notifications/events/:eventId/replay`.
- Use the retained event payload from the 30-day rolling window.
- Resend the original event id and payload rather than synthesizing a new product event.
- Add replay audit fields such as `lastReplayedAt`, `manualReplayCount`, and `replayedBy`.
- Clear `retentionExpiresAt` before redelivery and set a new expiry after replay reaches a terminal state.

### Payload Expansion

- Add safe summaries only.
- Use new `version` when changing payload semantics.
- Keep old versions supported while configured receivers migrate.

### Alternative Queue Backend

- If Mongo polling becomes insufficient, keep the public notification event model and replace only the outbox delivery backend.

### Transactional Outbox

- Add Mongo session support to affected write paths.
- Insert domain writes and notification outbox events in one Mongo transaction.
- Keep enqueue failure non-blocking only where the domain write has already committed and transactional recovery is not possible.

## Implementation Notes for Agents

- Keep notification modules separate from OpenID4VCI inbound notification modules.
- Do not rename or overload existing `messagingSettings`.
- Keep event builders small and deterministic.
- Prefer existing repo and plugin patterns over new abstractions.
- Do not add a heavy queue dependency unless Mongo leasing cannot satisfy requirements.
- Use `child_process.fork()` for embedded worker supervision; avoid PM2 and avoid introducing a process-manager dependency.
- Use Cockatiel only for delivery policies if it reduces custom retry/backoff/timeout/circuit-breaker code.
- Make worker delivery code callable from tests without forking a process.
- Make process supervisor code thin and separately testable.
- Keep generated event payloads ASCII-safe JSON.
- Document every new environment variable in the credentialing hub README or package docs.

## Resolved Decisions

- Outbox insert failure must not fail the API request, including regulated deployments.
- HMAC is sufficient for the first LAN-targeted release; mTLS can remain an optional future hardening feature.
- Rejected credential events should include a sanitized rejection reason when available.
- Terminal notification events should be retained for a configurable rolling window, with a 30-day default.
- Manual replay should be treated as an extension, not core MVP scope.
