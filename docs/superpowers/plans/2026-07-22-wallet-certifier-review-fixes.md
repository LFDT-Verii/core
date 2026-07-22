# Wallet Certifier Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the actionable security, validation, polling, observability, and coverage feedback on Core PR #831 while explicitly deferring concurrent first-start serialization to phase two.

**Architecture:** Validate Hub interaction redirects at the server adapter boundary against the configured Hub origin, then retain a client-side executable-scheme guard before navigation. Preserve HTTP status metadata in application API errors so the polling hook can distinguish retryable failures. Keep validation and logging behavior covered through public endpoints, with focused application integration tests for browser behavior.

**Tech Stack:** Node.js 24, Fastify, React 19, Node test runner, Testing Library, MongoDB integration tests, pnpm/Nx.

## Global Constraints

- Phase one remains VN_API-only and retains its current applicant-driven start flow.
- Concurrent first `/start` serialization is documentation-only in this change and moves to phase two.
- HTTP interaction redirects are allowed only for loopback development hosts in the browser; production interactions require HTTPS.
- Unexpected server errors remain sanitized in HTTP responses even when the full error is logged.
- Do not reply to or resolve GitHub review threads, commit, or push unless separately requested.

---

### Task 1: Document the Phase-Two Concurrency Boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-07-21-wallet-certifier-design.md`

**Interfaces:**
- Consumes: The phase-one `/runs/{runId}/start` behavior and existing reconciliation lease model.
- Produces: An explicit phase-two requirement for atomic ownership of first-stage Hub resource creation.

- [ ] **Step 1: Add the phase-two concurrency note**

Add this paragraph to section 8.4:

```markdown
Concurrent initialization of the same interaction stage is phase-two work. Phase one returns a stored interaction for sequential retries and prevents duplicate applicant actions in the UI, but it does not serialize simultaneous first `POST /runs/{runId}/start` requests. Phase two will claim atomic ownership before creating a depot, setup credential, or Hub link so concurrent and transport-level retries share one initialization result.
```

- [ ] **Step 2: Verify the wording is present once**

Run: `rg -n "Concurrent initialization|atomic ownership" docs/superpowers/specs/2026-07-21-wallet-certifier-design.md`

Expected: Both phrases appear in section 8.4 and nowhere else.

### Task 2: Reject Untrusted Wallet Interaction Redirects

**Files:**
- Modify: `servers/wallet-certifier/test/runs-controller.test.js`
- Modify: `servers/wallet-certifier/src/adapters/hub-client.js`
- Modify: `apps/wallet-certifier/src/api.test.jsx`
- Modify: `apps/wallet-certifier/src/api.js`
- Modify: `apps/wallet-certifier/src/pages/WaitingPage.test.jsx`
- Modify: `apps/wallet-certifier/src/pages/WaitingPage.jsx`

**Interfaces:**
- Consumes: `createHubClient({ baseUrl })`, `api.startRun(runId, token)`, and the window returned by `window.open`.
- Produces: Hub-link responses constrained to the configured Hub origin, an `ApiError` for unsafe browser redirect schemes, and a disclosure tab with `opener === null`.

- [ ] **Step 1: Write failing public-endpoint and application tests**

In the run endpoint test, make the dependency server's redirect mutable and assert that a cross-origin redirect returns the existing sanitized 502 response:

```js
hubRedirectUrl = 'https://attacker.example/app-redirect';
const started = await api.inject({
  method: 'POST',
  url: `/api/runs/${created.json().runId}/start`,
  headers: { authorization: 'Bearer test-interaction-token' },
});
expect(started.statusCode).toEqual(502);
expect(started.json()).toEqual({
  error: 'credentialing_hub_unavailable',
  message: 'Credentialing Hub is temporarily unavailable.',
});
```

In `api.test.jsx`, return a `javascript:` redirect from `fetch` and assert that `api.startRun` rejects it. In `WaitingPage.test.jsx`, initialize the opened disclosure tab with a non-null opener and assert that the component clears it before awaiting `api.startRun`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm --filter @verii/server-wallet-certifier test -- test/runs-controller.test.js`

Expected: FAIL because the cross-origin redirect is returned with status 200.

Run: `pnpm --filter @verii/wallet-certifier-app test -- src/api.test.jsx src/pages/WaitingPage.test.jsx`

Expected: FAIL because `javascript:` is accepted and the disclosure tab retains its opener.

- [ ] **Step 3: Validate redirect data at both trust boundaries**

In `hub-client.js`, validate every Hub response containing `redirectUrl` by parsing it and comparing `url.origin` to `new URL(baseUrl).origin`; translate parse or origin failures to `HubUnavailableError`.

In `api.js`, normalize successful start responses through a helper with this policy:

```js
const allowed =
  redirect.protocol === 'https:' ||
  (redirect.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(redirect.hostname));
```

Throw `ApiError('The wallet interaction URL is invalid.')` when the policy fails. In `WaitingPage.jsx`, set `walletTab.opener = null` immediately after the synchronous `window.open` call.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the two commands from Step 2.

Expected: All focused server and app tests pass.

### Task 3: Validate the Trimmed Wallet Search Query

**Files:**
- Modify: `servers/wallet-certifier/test/config-wallets-controller.test.js`
- Modify: `servers/wallet-certifier/src/controllers/wallets-controller.js`

**Interfaces:**
- Consumes: `GET /api/wallets?q=<query>`.
- Produces: HTTP 400 for any query containing fewer than two non-whitespace characters after trimming.

- [ ] **Step 1: Extend the endpoint validation test**

Add requests for `%20%20` and `%20x%20` to the existing bounded-input test and assert both return 400 without reaching Registrar.

- [ ] **Step 2: Run the endpoint test and verify RED**

Run: `pnpm --filter @verii/server-wallet-certifier test -- test/config-wallets-controller.test.js`

Expected: FAIL because raw string length currently allows whitespace-only and padded one-character queries.

- [ ] **Step 3: Enforce two non-whitespace characters in the request schema**

Change the `q` schema to:

```js
q: {
  type: 'string',
  minLength: 2,
  maxLength: 80,
  pattern: '^\\s*\\S.*\\S\\s*$',
},
```

- [ ] **Step 4: Run the endpoint test and verify GREEN**

Run the command from Step 2.

Expected: The endpoint suite passes and Registrar receives only trimmed valid queries.

### Task 4: Stop Polling on Non-Retryable Client Errors

**Files:**
- Modify: `apps/wallet-certifier/src/api.test.jsx`
- Modify: `apps/wallet-certifier/src/api.js`
- Modify: `apps/wallet-certifier/src/pages/WaitingPage.test.jsx`
- Modify: `apps/wallet-certifier/src/hooks/useRunPolling.js`

**Interfaces:**
- Consumes: Failed `fetch` responses and errors thrown by `api.getRun`.
- Produces: `ApiError` instances with `status` and `code`, plus retries only for missing status, 429, or 5xx failures.

- [ ] **Step 1: Write failing status and scheduling tests**

In `api.test.jsx`, assert a 404 response rejects with `{ status: 404, code: 'run_not_found' }`. In `WaitingPage.test.jsx`, mock `window.setTimeout`, reject `getRun` with a status-404 error, render the page, and assert the message appears without scheduling another poll. Add the corresponding status-503 case and assert one 5,000 ms retry is scheduled.

- [ ] **Step 2: Run the app tests and verify RED**

Run: `pnpm --filter @verii/wallet-certifier-app test -- src/api.test.jsx src/pages/WaitingPage.test.jsx`

Expected: FAIL because API errors lose their status and every failure schedules a retry.

- [ ] **Step 3: Preserve error metadata and gate retries**

Add this error interface in `api.js`:

```js
export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
```

Throw it from `requestJson`. In `useRunPolling.js`, retry only when:

```js
requestError.status == null ||
requestError.status === 429 ||
requestError.status >= 500
```

- [ ] **Step 4: Run the app tests and verify GREEN**

Run the command from Step 2.

Expected: The app tests pass; 404 stops polling while 503 retries after five seconds.

### Task 5: Log Unexpected Errors Without Leaking Them to Clients

**Files:**
- Modify: `servers/wallet-certifier/test/config-wallets-controller.test.js`
- Modify: `servers/wallet-certifier/src/build-server.js`

**Interfaces:**
- Consumes: An unexpected exception reaching Fastify's error handler.
- Produces: A structured Pino log containing `err` and `errorCode`, while the response remains the generic `internal_error` payload.

- [ ] **Step 1: Write a failing endpoint observability test**

Have the test Registrar return malformed JSON for a dedicated valid query. Call `GET /api/wallets` with that query, assert the response is the generic 500 payload, and assert the captured logs contain the JSON parse error while the HTTP response does not contain it.

- [ ] **Step 2: Run the endpoint test and verify RED**

Run: `pnpm --filter @verii/server-wallet-certifier test -- test/config-wallets-controller.test.js`

Expected: FAIL because the current log contains only `errorCode`.

- [ ] **Step 3: Attach the error object to the structured log**

Change the unexpected-error log call to:

```js
request.log.error(
  { err: error, errorCode: 'internal_error' },
  'Request failed',
);
```

- [ ] **Step 4: Run the endpoint test and verify GREEN**

Run the command from Step 2.

Expected: The test passes, the response remains sanitized, and the structured log includes exception details.

### Task 6: Verify the Complete Review-Fix Set

**Files:**
- Verify all files changed by Tasks 1-5.

**Interfaces:**
- Consumes: The completed review fixes.
- Produces: Green package tests, lint, build, and CI-compatible coverage artifacts.

- [ ] **Step 1: Run package lint**

Run: `pnpm --filter @verii/wallet-certifier-app lint && pnpm --filter @verii/server-wallet-certifier lint`

Expected: Both linters exit 0.

- [ ] **Step 2: Run complete package tests**

Run: `pnpm --filter @verii/wallet-certifier-app test && pnpm --filter @verii/server-wallet-certifier test`

Expected: All tests pass with no failures.

- [ ] **Step 3: Generate CI coverage**

Run: `pnpm --filter @verii/wallet-certifier-app test:ci && pnpm --filter @verii/server-wallet-certifier test:ci`

Expected: Both commands exit 0 and write `lcov.info` reports.

- [ ] **Step 4: Run affected verification**

Run: `pnpm exec nx affected --target=lint,test,build --base=origin/main --head=HEAD`

Expected: Wallet Certifier's affected projects pass all configured targets.

- [ ] **Step 5: Review the final diff and working tree**

Run: `git diff --check && git status --short && git diff --stat`

Expected: No whitespace errors; only the planned source, test, and documentation files are modified.
