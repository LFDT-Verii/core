## Changes

### [#1159](https://github.com/LFDT-Verii/core/pull/1159) Bind OpenID4VCI key proofs to Hub-issued nonces

The OpenID4VCI nonce endpoint returns a signed `c_nonce` that the Hub doesn't need to store, and the credential endpoint rejects proofs whose nonce is missing, expired, altered or issued for another tenant. Proofs must also set `aud` to the tenant's credential issuer URL (`<HOST_URL>/r/<tenantId>`), as OpenID4VCI 1.0 requires ([#1163](https://github.com/LFDT-Verii/core/pull/1163)).

### [#893](https://github.com/LFDT-Verii/core/pull/893) Publish a Credentialing Hub Docker image

Production releases publish a multi-architecture image to Docker Hub as `lfdecentralizedtrust/verii-credentialing-hub`, tagged with the exact version and `latest` ([#910](https://github.com/LFDT-Verii/core/pull/910)). The blockchain network and OAuth client are configured at runtime, and `--velocity-devnet`, `--velocity-testnet` and `--velocity-mainnet` preset the Velocity Network settings.

### [#926](https://github.com/LFDT-Verii/core/pull/926) Choose the credential signing algorithm per tenant

Operators can set a tenant's `credentialSigningAlgorithm` (`SECP256K1`, `ES256` or `RS256`) at creation or through the new `POST /operator/tenants/update`; otherwise the credential type's default applies, then `SECP256K1`. ES256 credentials are anchored with P-256 keys and COSE-key metadata ([#928](https://github.com/LFDT-Verii/core/pull/928)), and OpenID4VCI issuer metadata advertises the algorithm in use instead of always `ES256K`.

### [#1109](https://github.com/LFDT-Verii/core/pull/1109) Require tenant keys to match the organization's DID document

Tenant creation rejects keys that differ from the key the organization's DID document publishes at their `kidFragment`, private JWKs whose public part belongs to another key ([#1110](https://github.com/LFDT-Verii/core/pull/1110)), and a `primaryAccount` that differs from the organization's on-chain account. Keys sent in both forms are imported from their JWK ([#1151](https://github.com/LFDT-Verii/core/pull/1151)), and unparseable key material returns 400 instead of 500.

### [#1096](https://github.com/LFDT-Verii/core/pull/1096) Run the notification worker independently of the CAO security provider

The notification worker starts from Hub configuration and MongoDB alone, so deployments with a custom CAO security provider no longer need the built-in provider's settings for notifications. Wrappers can choose each event's webhook with `startNotificationWorker({ resolveDestination })` or fork their own worker with `startAppServer({ notificationWorkerModulePath })`, and every event carries the tenant's `caoDid` ([#1094](https://github.com/LFDT-Verii/core/pull/1094)).

### [#921](https://github.com/LFDT-Verii/core/pull/921) Record credential format metadata

Issued credentials record their `dataModelVersion`, `envelopeFormat` and `signingAlgorithm`, which appear in Operator credential responses, `credential.issued` webhooks and revocation messages. Values for credentials issued before the upgrade are derived when read, so no migration is needed.

### [#1066](https://github.com/LFDT-Verii/core/pull/1066) Tighten presentation verification

Presentation verification reports `SELF_SIGNED` only when the issuer is the `did:jwk` of the signing key and matches `kid`s exactly ([#1065](https://github.com/LFDT-Verii/core/pull/1065)). It also accepts P-256 issuer keys ([#1061](https://github.com/LFDT-Verii/core/pull/1061)).

### [#1064](https://github.com/LFDT-Verii/core/pull/1064) Accept offer proofs from did:web holders

VN-API issuance verifies proofs whose `kid` isn't a `did:jwk` against the key the Registrar resolves, so holders with `did:web` and similar DIDs can accept offers instead of failing with `proof_verify_failed`.

### [#1122](https://github.com/LFDT-Verii/core/pull/1122) Ignore repeated credential_accepted notifications

A repeated OpenID4VCI `credential_accepted` notification returns 204 without anchoring the credential again, instead of returning `server_error` and marking the accepted credential with an error.

### [#1119](https://github.com/LFDT-Verii/core/pull/1119) Report Hub errors to Sentry

The Hub reads `SENTRY_DSN` and `ENABLE_SENTRY_DEBUG` and tags its events with `service: @verii/server-credentialing-hub` ([#1115](https://github.com/LFDT-Verii/core/pull/1115)). Without a DSN it logs once at startup that Sentry reporting is off.

### [#1095](https://github.com/LFDT-Verii/core/pull/1095) Keep secrets out of Hub logs

The startup log lists configuration names only, so values such as `NOTIFICATIONS_WEBHOOK_SECRET` are no longer logged. HTTP client logs redact authorization and cookie headers ([#1021](https://github.com/LFDT-Verii/core/pull/1021)), and tenant-creation bodies are no longer logged at debug level ([#1151](https://github.com/LFDT-Verii/core/pull/1151)).

### [#1008](https://github.com/LFDT-Verii/core/pull/1008) Update the OpenID4VC libraries

The `@openid4vc/*` packages move from 0.5.4 to 0.8.2 ([#1100](https://github.com/LFDT-Verii/core/pull/1100), [#1137](https://github.com/LFDT-Verii/core/pull/1137)). Proof JWTs may use the full `application/openid4vci-proof+jwt` `typ` in any casing.

### [#1088](https://github.com/LFDT-Verii/core/pull/1088) Use custom provider blockchain credentials in test mode

Under `NODE_ENV=test`, a custom CAO security provider's blockchain credentials are used by `createAppServer` and `createTestServer`, so wrappers no longer need `configOverrides: { isTest: false }`.

## Backward incompatibilities

- `OPENID4VCI_NONCE_SECRET` is required by every Hub process that serves HTTP and must have the same value on every instance. Wrappers calling `createAppServer` must set it in the environment. Changing the secret or `HOST_URL` invalidates outstanding nonces; `OPENID4VCI_NONCE_EXPIRES_IN` defaults to `5m`.
- OpenID4VCI credential requests reject proofs without a nonce (400 `invalid_proof`) and proofs with an expired, altered, other-tenant or pre-upgrade nonce (400 `invalid_nonce`). Wallets must fetch a nonce from the nonce endpoint, and nonces issued before the upgrade fail once.
- OpenID4VCI proofs must set `aud` to `<HOST_URL>/r/<tenantId>`; wallets that send the bare host get `invalid_proof`.
- Pre-authorized-code token requests that include a `code_verifier` are rejected with `invalid_grant`.
- VN-API offer proofs must set `iss` to exactly the `kid`'s DID; a full DID URL in `iss` gets `proof_iss_invalid`.
- Tenant creation requires each key to match the organization's DID document, which must publish it as `publicKeyJwk` or an uncompressed secp256k1 `publicKeyHex` or `publicKeyBase58`. Organizations that publish `publicKeyMultibase` or compressed keys can't be onboarded; existing tenants are not re-checked.
- Tenant creation rejects inconsistent JWKs (400 `key_invalid`) and hex and JWK forms of a key that disagree (400 `key_formats_mismatch`).
- Tenant creation always looks up `primaryAccount` on chain, so it needs a working RPC node, and a supplied value that doesn't match returns 400 `primary_account_must_match_chain`.
- Notification events gain a top-level `caoDid` (`null` for tenants without one), and `credential.issued` data gains `dataModelVersion`, `envelopeFormat` and `signingAlgorithm`. Webhook receivers that reject unknown fields must be updated.
- OpenID4VCI issuer metadata `credential_signing_alg_values_supported` lists the algorithm in use first, or only the tenant's override, instead of always `['ES256K']`.
- Presentation verification reports `trustedIssuerCheck: FAIL` instead of `SELF_SIGNED` for credentials signed with an embedded key not bound to their issuer.
- `startNotificationWorker` no longer accepts `createAppServer`, and `notificationWorkerModulePath` must be an absolute path to an existing file.
- Hubs that already have `SENTRY_DSN` in their environment start sending events to Sentry.
- The `Server Configured` startup log reports configuration names instead of values.

## Known issues

- Tenant creation still accepts only `SECP256K1` keys ([#746](https://github.com/LFDT-Verii/core/issues/746)), so organizations whose Registrar keys are P-256 (`ES256_ORGANIZATION_KEYS`) can't be onboarded yet. ES256 credential signing ([#926](https://github.com/LFDT-Verii/core/pull/926)) doesn't need ES256 tenant keys: each credential is signed with a new key of the chosen algorithm.
- When two requests create the same tenant at once, the Hub imports both requests' keys before the duplicate insert fails, so the losing request's keys stay in the KMS with no tenant ([#1169](https://github.com/LFDT-Verii/core/issues/1169)).
