# Wallet Certifier Design

**Date:** 2026-07-21

**Status:** Approved for implementation planning

**Phase-one protocol:** Velocity Network API (VN_API)

**Initial environments:** Devnet and testnet

## 1. Summary

The Wallet Certifier is a public, low-volume Velocity Network Foundation application that lets wallet providers test issuing and verification support against a preconfigured Credentialing Hub tenant. The application uses the approved “Trust Ledger” visual direction: warm paper surfaces, true black typography, a guided dossier layout, restrained motion, and a single bright-green status dot for successful presentation and credential checks. The Velocity Network Foundation logo is the default and can be replaced through deployment configuration.

Phase one deliberately favors operational clarity over event-driven scale. A React application calls a serverless Wallet Certifier API, and an idempotent reconciler polls Credentialing Hub. MongoDB is the single application datastore and contains a sanitized run journal that support can follow from start to finish. EventBridge provides background progress when the browser is closed. DynamoDB, Dynamo Streams, SQS, an application evidence bucket, and Hub webhooks are not required.

Phase one uses the Credentialing Hub's existing global operator token and is hard-bound server-side to the VNF tenant. Multi-CAO Hub authentication, OpenID4VCI, OpenID4VP, and PDF reports move to phase two.

## 2. Goals

- Certify VN_API issuing of a personalized `OpenBadgeCredential` using pre-authorized-code issuing.
- Certify VN_API presentation and verification, including disclosure of the exact badge created for the verification run.
- Let applicants select a registered wallet, identify themselves, and receive a clear result without signing in.
- Continue monitoring and send terminal-result email even if the applicant closes the browser.
- Give support a compact, chronological explanation of each run.
- Keep the runtime and dependent-package changes proportional to very low traffic.
- Deploy isolated devnet and testnet stacks against their matching Hub and Registrar environments.
- Preserve a path to additional protocols and certification capabilities.

## 3. Non-goals

Phase one does not:

- Update certification status in Registrar.
- Support OpenID4VCI or OpenID4VP certification.
- Support multiple CAO-scoped Hub operator tokens.
- Generate a PDF report.
- Provide a support administration UI.
- Require an applicant account or login.
- Use Hub webhook delivery or a WebSocket connection.
- Certify issuing support during the setup issuance performed for a verification run.

## 4. User journey

### 4.1 Wallet and applicant setup

1. The applicant searches wallets through the existing Registrar organization-profile search, restricted to `HolderAppProvider` profiles.
2. Results show all matching wallets. VN_API and dual-protocol wallets are selectable. OpenID-only wallets remain visible but disabled with an explanation that OpenID certification arrives in phase two.
3. If the wallet is absent, the application links the applicant to the existing wallet-registration process.
4. The applicant enters their name and email address.
5. The applicant selects **Certify issuing** or **Certify verification**.

The server revalidates the selected organization against Registrar before creating a run. The browser cannot supply or override a Hub tenant, service, CAO, or network.

### 4.2 Issuing certification

1. The server creates a Hub depot for the run.
2. It creates one personalized `OpenBadgeCredential` using the selected wallet organization's name and the applicant's name and email address.
3. It refreshes the Hub issue links using a pre-authorized code.
4. From the applicant's click, the browser synchronously opens a blank tab and later navigates it to the Hub app-redirect page. The URL includes the selected wallet and the VN protocol link only. Dual-protocol wallets are therefore tested through VN_API in phase one.
5. The waiting screen shows a progress indicator, the remaining action time, and a warning not to close the page until the result appears. It also shows a fallback link and QR code if the new tab is blocked or the wallet must be opened on another device.
6. The browser polls Wallet Certifier status. The scheduled monitor continues polling if the browser closes.
7. A successful result displays issuance time, credential details, raw JSON, and JWT inline in the credential section.
8. Rejection, Hub exchange error, internal failure, or timeout produces a specific terminal result.

### 4.3 Verification certification

Verification has two wallet interactions, and each receives its own deadline.

1. **Setup issuance:** the server creates and issues a personalized `OpenBadgeCredential` exactly as in the issuing journey. This is test setup and does not count as issuing certification.
2. Once setup issuance succeeds, the interface asks the applicant to continue to credential sharing. The explicit click opens the Hub redirect reliably despite browser popup restrictions.
3. **Disclosure:** the server refreshes the presentation link for the same depot and directs the selected wallet through VN_API.
4. The applicant may disclose other credential types, but the presentation must contain the exact setup badge.
5. The server retrieves the presentation and asks Hub to verify it.
6. The result first shows whether the presentation is verified, using one bright-green dot on success. It then shows every disclosed credential, the status icon for each applicable check, and the credential JSON and JWT inline.

Verification passes only when:

- The presentation-level verification passes.
- The disclosed JWT fingerprint matches the SHA-256 fingerprint of the exact setup badge issued for the run.
- The setup badge itself passes all applicable credential checks.
- Every additional credential passes all applicable checks.

An absent or nonmatching setup badge is a verification failure even if all other credentials are valid.

### 4.4 Terminal communication

Every terminal outcome creates two notification jobs:

- An applicant email sent to the submitted address.
- An internal email sent to a configurable address, initially `support@velocitynetwork.foundation`.

Emails contain the environment, wallet, capability, outcome, run ID, relevant timestamps, a short explanation, and a secure result link. They never contain raw credential JSON, JWTs, presentation data, or access capabilities in the message body beyond the result-link fragment.

The result page offers **Start a new test**. A retry is a new immutable run rather than a reset of the previous run.

## 5. Visual and interaction design

The approved Trust Ledger direction uses:

- Warm, paper-like backgrounds and ruled-ledger details.
- True black (`#0d0d0c`) instead of navy-black.
- A guided dossier sidebar that makes the current stage clear.
- Minimal waiting screens with restrained progress motion.
- Outcome-first result pages.
- One bright-green dot for both “Presentation verified” and individual verified credentials; no second decorative status circle.
- Credential sections that expose JSON and JWT inline without separate reveal buttons.
- Configurable logo and organization name with VNF defaults.
- Responsive layouts, keyboard operation, visible focus, reduced-motion support, and accessible status text that does not depend on color.

The PDF report action is hidden in phase one and added with report generation in phase two.

## 6. Architecture

### 6.1 Runtime

The phase-one runtime consists of:

- A React/Vite single-page application on S3 and CloudFront.
- API Gateway HTTP API.
- An API Lambda for public endpoints.
- A scheduled monitor/notification Lambda built from the same server package.
- An EventBridge one-minute schedule.
- MongoDB Atlas as the authoritative application datastore.
- SES for email.
- Secrets Manager, WAF, and CloudWatch.

While a waiting page is open, it calls the status endpoint every few seconds. If the run's `nextCheckAt` is due, the API invokes the same idempotent reconciliation service used by the scheduled monitor. This normally produces prompt UI updates without requiring WebSockets. The scheduled Lambda scans due active runs once per minute and guarantees progress after the browser closes.

The architecture omits DynamoDB, Dynamo Streams, SQS, an application evidence bucket, and Hub webhook delivery. These services add cross-store state and operational paths that are not justified by the expected volume.

### 6.2 Package boundaries

#### `apps/wallet-certifier`

- Trust Ledger React/Vite interface.
- Wallet search, applicant form, capability selection, waiting, and result routes.
- Result-link fragment exchange and secure session handling.
- Runtime branding and environment configuration.
- No secrets or tenant-selection controls.

The application follows the established React application conventions in the sibling monorepo: React 18 and React DOM, Vite with the React SWC plugin, React Router 7, MUI/Emotion, React Hook Form, Testing Library, and the standard Nx lint/build/test scripts. `qrcode.react` renders the wallet fallback QR code. A dedicated MUI theme and small, feature-local styled components implement the Trust Ledger direction; React Admin, Auth0, Redux, analytics, and a second styling framework are unnecessary.

The root workspace configuration adds `apps/*` so this application participates in normal build, lint, and test tooling.

#### `servers/wallet-certifier`

- Public API and scheduled handlers.
- Pure state, deadline, and result rules under `src/domain`.
- Reconciliation orchestration.
- Mongo repositories.
- Credentialing Hub and Registrar clients.
- Evidence normalization and fingerprinting.
- Result-session and capability handling.
- SES notification processing.

There is no separate domain workspace package. Pure domain modules remain small and independently testable inside the server, matching existing repository conventions.

Issuing and verification implement a common workflow interface for preparation, reconciliation, result projection, and terminal notification. The two workflows may have different states, but the API and persistence layers dispatch by the stored capability. A future certification capability can therefore add a workflow without changing the public run lifecycle.

The HTTP API uses Fastify 5 and the official `@fastify/aws-lambda` adapter. The server package exports a `buildServer()` factory that registers routes, validation, security headers, sanitized logging, repositories, and downstream clients. The Lambda entry point creates the Fastify proxy once at module scope for warm-start reuse. A small standalone entry point runs the same server locally, and integration tests exercise public routes with Fastify injection.

The scheduled monitor/notification handler imports the same reconciliation, repository, and notification services directly; it does not route EventBridge events through Fastify. The implementation reuses compatible Verii schemas, logger conventions, and Fastify plugins selectively, but does not call `@verii/server-provider.createServer()` because its long-running-server defaults and full debug request/response hooks do not satisfy this application's Lambda and evidence-redaction requirements. No change to the shared server-provider package is required.

#### `servers/credentialinghub`

Phase one adds safe operator exchange inspection described in section 11. No other Hub package needs to change.

#### Engineering sibling repository

The engineering repository owns all AWS, Atlas, Hub runtime configuration, secrets, alarms, and environment-specific deployment work described in section 12.

### 6.3 Existing packages that do not change

- Registrar already provides the required `HolderAppProvider` profile search.
- The existing wallet-selection/app-redirect interface accepts wallet preselection. Wallet Certifier constructs the redirect with `wallet=<selected-wallet>` and the VN protocol link, omitting the OpenID URI in phase one.
- No shared domain package is introduced.

## 7. Data design

Mongo uses three application collections.

### 7.1 `certificationRuns`

This is the sanitized, authoritative run summary. It contains:

- Public run ID and environment.
- Selected wallet organization ID and display name.
- Capability and protocol.
- Current stage, terminal outcome, revision, lease, and deadlines.
- Hub tenant, service, depot, credential, presentation, and exchange references.
- Verification summaries, check outcomes, and evidence fingerprints.
- Poll counters, last-check time, latest Hub request ID, and consecutive-error count.
- A bounded chronological journal of meaningful state changes and changed errors.
- Sanitized applicant/support email-delivery status.
- `createdAt`, terminal timestamps, and a 12-month `purgeAt` TTL.

It does not contain applicant name, applicant email, raw credentials, raw presentations, JWTs, result capabilities, protocol tokens, or raw Hub errors.

### 7.2 `runEvidence`

This collection contains sensitive run material in bounded documents:

- A subject document containing applicant name and email.
- Hashed short-lived interaction capability.
- Hashed applicant and support result capabilities and their seven-day expiry.
- One document per raw issued or disclosed credential.
- One document for the raw presentation.
- JSON/JWT payloads and their SHA-256 fingerprints.

Every document has a 30-day `purgeAt` TTL. Individual evidence documents have a configured size limit below Mongo's 16 MiB document limit. Oversized or excessive disclosure is rejected safely and reported as a verification failure or processing error, as appropriate.

### 7.3 `notificationJobs`

Each deterministic job ID contains the run ID, audience, template version, and terminal-result version. A job records:

- Recipient and template data.
- `pending`, `processing`, `sent`, or `failed` status.
- Lease, attempt count, last error code, next attempt, and SES message ID.
- A 30-day `purgeAt` TTL.

The deterministic ID prevents ordinary duplicate job creation. Because SES send and Mongo status update cannot be atomic, a process failure immediately after SES accepts a message can still cause a rare duplicate on retry. The recorded attempt and SES identifiers make this diagnosable.

### 7.4 Retention boundary

- The interaction capability expires at the run's last finalization deadline.
- Applicant and support result capabilities expire seven days after the terminal result.
- Name, email, raw JSON/JWT, presentation evidence, capability hashes, and notification destinations are deleted from live Mongo no later than 30 days after run creation.
- Sanitized certification summaries are deleted 12 months after the terminal result. A nonterminal run uses creation time as the retention baseline.
- Atlas backups follow the existing engineering backup-retention policy. The 30-day guarantee applies to live application data, as approved.

## 8. State and deadline model

### 8.1 Issuing states

```text
CREATED
  -> PREPARING_BADGE
  -> AWAITING_ISSUANCE
  -> FINALIZING_ISSUANCE
  -> PASSED
```

### 8.2 Verification states

```text
CREATED
  -> PREPARING_SETUP_BADGE
  -> AWAITING_SETUP_ISSUANCE
  -> FINALIZING_SETUP_ISSUANCE
  -> PREPARING_DISCLOSURE
  -> AWAITING_DISCLOSURE
  -> VERIFYING_PRESENTATION
  -> PASSED | FAILED_VERIFICATION
```

Both capabilities may terminate as:

- `FAILED_REJECTED`: the holder rejected issuance.
- `FAILED_EXCHANGE`: Hub recorded an authentication, protocol, client, or unexpected exchange error.
- `FAILED_TIMEOUT`: the holder did not begin the action in time or finalization exceeded its deadline.
- `FAILED_INTERNAL`: Wallet Certifier could not finish after safe bounded retries.

Terminal states are immutable.

### 8.3 Deadlines

Each issuing or disclosure interaction records:

- `actionDeadlineAt`: 10 minutes after the interaction starts.
- `finalizationDeadlineAt`: 15 minutes after the interaction starts.

The holder must begin qualifying Hub activity by the action deadline. If Hub activity began on time, processing may finish during the additional five minutes. Hub event timestamps, rather than the later poll time, determine whether activity began in time. If qualifying activity did not begin by 10 minutes, the run fails even if the wallet acts later. Verification setup issuance and disclosure receive independent deadline pairs.

### 8.4 Reconciliation and concurrency

The shared reconciler:

- Claims a short Mongo lease when `nextCheckAt` is due.
- Uses the run revision and current state in every state-changing update.
- Treats all Hub reads and verification calls as replayable.
- Records safe identifiers and meaningful transitions before releasing the lease.
- Retries transient Hub/network errors with bounded backoff within the final deadline.
- Produces deterministic terminal notification jobs only after the terminal transition commits.
- Never reopens a terminal run.

The timeline records state changes and changed errors rather than every pending check. Counters and last-check fields retain polling diagnostics without making the journal unreadable.

## 9. API design

All request bodies have explicit size limits and schema validation.

### `GET /wallets?q=<query>`

Proxies a bounded Registrar search restricted to `HolderAppProvider`. It returns only fields needed for selection and protocol eligibility.

### `POST /runs`

Validates applicant details, revalidates the wallet, and creates a run. It returns the public run ID and a short-lived interaction capability. Tenant, services, protocol, and environment come only from server configuration.

### `POST /runs/{runId}/start`

Starts the next legal interaction for the run and returns the Hub app-redirect URL plus QR/deep-link fallback data. It is capability-protected and idempotent for the current stage.

### `GET /runs/{runId}`

Returns the applicant-safe state or result. For an active run whose next check is due, it may perform an idempotent reconciliation before responding. Per-run throttling prevents browser polling from increasing Hub traffic beyond the configured interval.

### `POST /result-sessions`

Exchanges an applicant or support capability read from the URL fragment for a `Secure`, `HttpOnly`, `SameSite=Strict` cookie. The client immediately removes the fragment from browser history.

### `GET /support/runs/{runId}`

Returns the sanitized run summary, diagnostics, notification status, and chronological journal. API Gateway requires AWS IAM authorization. It never returns raw evidence or applicant contact details.

No restart endpoint is required. Starting again creates a new run.

## 10. Security and privacy

- The application is public and does not require login.
- Public run IDs are not authorization secrets.
- Applicant and support result links use separate cryptographically random capabilities so they can be revoked independently.
- Only capability hashes are stored.
- Result cookies are secure, HTTP-only, same-site, scoped narrowly, and expire no later than the corresponding capability.
- CSRF protections include same-site cookies and origin validation on state-changing routes.
- Devnet and testnet use separate Atlas databases, users, secrets, and fixed downstream URLs.
- Mongo users are least-privilege and connections use TLS. Atlas provides encryption at rest.
- Hub credentials, Mongo credentials, CAPTCHA secrets, and SES configuration reside in Secrets Manager.
- Raw evidence, names, email addresses, result capabilities, and Hub protocol tokens never enter CloudWatch logs or the sanitized run journal.
- Logs use the run ID, Hub request ID, object references, normalized error code, stage, and attempt count.
- WAF applies IP-based rate limits. Suspicious behavior activates CAPTCHA; normal low-volume use does not add CAPTCHA friction.
- Result pages use a strict Content Security Policy, security headers, `noindex`, no analytics, and no third-party scripts.
- The server is hard-bound to the configured VNF tenant and service IDs. Browser input cannot select another tenant.

The IAM-authorized support route provides read-only run diagnostics. A phase-one support UI is unnecessary.

## 11. Credentialing Hub changes

### 11.1 Phase one: selected Version B

Phase one keeps the existing global `OPERATOR_API_TOKEN` and requires only the exchange-inspection work already represented by [LFDT-Verii/core issue #751](https://github.com/LFDT-Verii/core/issues/751).

The operator endpoint must:

- Load an exchange by `exchangeId`, or the latest VN_API exchange by `depotId`.
- Enforce the requested `tenantId` through the existing tenant loader.
- Return exchange ID, depot ID, service ID, type, protocol, safe state/event history and timestamps, normalized safe error information, and credential/presentation references when available.
- Omit raw credentials, presentations, JWTs, access tokens, challenges, protocol messages, and unsanitized exception details.
- Return stable not-found and invalid-query error codes.

Existing operator APIs already provide the other polling operations:

- Credential lookup by credential ID, including `acceptedAt`, `rejectedAt`, JSON, and JWT.
- Presentation lookup by depot ID.
- Presentation verification by presentation ID.

Hub webhook tenant allowlists, failure notification events, and notification-worker deployment are not required by the polling-first design.

### 11.2 Version A comparison: multi-CAO in phase one

The alternative version would add multi-CAO authentication before launching Wallet Certifier. It offers stronger tenant-level operator isolation immediately but expands the critical path and is unnecessary while only the preconfigured VNF tenant uses the application. It is therefore deferred.

### 11.3 Phase two: multi-CAO and OpenID

Phase two adds:

- Multiple active operator tokens per CAO to permit rotation.
- Bearer-token resolution to an authenticated `caoDid`.
- Enforcement that the loaded tenant's `caoDid` matches the authenticated CAO.
- A VNF-specific token for Wallet Certifier.
- Temporary compatibility with `OPERATOR_API_TOKEN` during migration.
- OpenID4VCI and OpenID4VP exchange state that is fully observable through the operator inspection and existing credential/presentation APIs.

Polling remains the default. OpenID-related Hub notification events are added only if operational evidence shows polling is inadequate.

No matching existing core issue was found for multi-CAO operator tokens, so phase-two planning should create a dedicated work item.

## 12. Engineering repository changes

Create separate devnet and testnet stacks containing:

- Private S3 application bucket and CloudFront distribution.
- Runtime configuration and configurable VNF logo/organization branding.
- API Gateway HTTP API.
- API Lambda and scheduled monitor/notification Lambda.
- EventBridge one-minute schedule.
- Atlas database and dedicated least-privilege database user per environment.
- Secrets Manager entries and narrowly scoped IAM policies.
- SES permissions, sender configuration, and configurable internal-support recipient.
- WAF rules and CAPTCHA configuration.
- CloudWatch log groups, dashboards, metrics, alarms, and retention.
- Deployment variables for fixed Hub URL, Registrar URL, VNF tenant ID, issuer service ID, relying-party service ID, VN protocol, and global operator token.

Lambdas use the existing VPC-to-Atlas pattern, a module-scoped cached `MongoClient`, and a small connection pool suitable for low concurrency.

Alarms cover:

- API and scheduled Lambda failures.
- EventBridge invocation failures.
- Runs remaining active beyond their final deadline.
- Repeated Hub failures.
- Notification jobs remaining pending or repeatedly failing.

## 13. Error handling

- Holder rejection produces `FAILED_REJECTED` and displays the safe exchange error if present.
- Hub exchange errors produce `FAILED_EXCHANGE` with the failed stage and normalized error details.
- No timely activity or incomplete finalization produces `FAILED_TIMEOUT`.
- Transient Hub, Registrar, Mongo, or SES failures retry with bounded backoff and recorded diagnostics.
- Failure to send email does not alter a completed certification result; notification status remains visible to support and triggers an alarm.
- Unsupported or oversized evidence fails safely without logging its contents.
- A blocked popup leaves the waiting page usable through the fallback app link and QR code.
- All failure pages show the run ID, timestamps, explanation, and **Start a new test** action.

## 14. Testing strategy

Repository testing follows these boundaries:

- Unit tests cover pure state transitions, deadline calculations, terminal-result rules, JWT fingerprint matching, and result projections.
- Integration tests exercise orchestration, adapters, persistence, capability/session handling, and validation through public-facing endpoints.
- Hub contract fixtures cover pending, accepted, rejected, presentation received, verification failure, and exchange-error responses.
- Concurrency tests cover duplicate browser/scheduler reconciliation, stale leases, revision conflicts, and terminal immutability.
- Notification tests cover deterministic job creation, retry, terminal result independence, and the post-send/pre-update duplicate edge case.
- End-to-end browser tests cover wallet search, registration guidance, issuing, verification setup, disclosure, popup fallback, timeout, error, and result-link flows.
- Accessibility tests cover keyboard navigation, status announcements, color-independent states, and reduced motion.
- Devnet smoke tests run against the provisioned VNF tenant before testnet is enabled.

## 15. Delivery phases

### Phase one

- VN_API issuing and verification.
- Verification setup badge and exact-badge disclosure rule.
- Existing global Hub operator token, hard-bound to the VNF tenant.
- Polling-first serverless runtime with Mongo.
- Inline JSON/JWT evidence.
- Applicant and configurable support emails.
- Trust Ledger UI.
- Devnet and testnet deployments.
- Hub issue #751 exchange inspection.

### Phase two

- Multi-CAO Hub authentication and VNF-specific token.
- OpenID4VCI and OpenID4VP certification.
- PDF report generation and download.
- Event delivery only if polling proves insufficient.

## 16. Acceptance criteria

Phase one is complete when:

- A registered VN_API-capable wallet can be selected in each environment.
- An applicant can complete an issuing test and see issued JSON/JWT and issuance time.
- An applicant can complete verification setup, disclose the exact badge plus optional other credentials, and see presentation and per-credential results.
- The exact setup badge rule and all applicable credential checks determine verification outcome correctly.
- Rejection, exchange failure, internal failure, and both deadline failures produce distinct terminal results.
- Monitoring and both emails complete without an open browser.
- The support timeline is sufficient to correlate a run with Hub request and object IDs without exposing raw evidence in logs.
- Seven-day link expiry, 30-day sensitive-data deletion, and 12-month summary deletion are enforced.
- Devnet and testnet are isolated and fixed to matching dependencies.
- Phase-one Hub changes are limited to safe exchange inspection.
- The approved Trust Ledger layouts, true-black palette, and single-dot verified treatment are implemented accessibly.
