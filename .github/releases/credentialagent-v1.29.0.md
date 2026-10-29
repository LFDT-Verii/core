## Changes

### [#920](https://github.com/LFDT-Verii/core/pull/920) Verify VC 2.0 credentials

The Credential Agent verifies W3C VC 2.0 `vc+jwt` credentials alongside VC 1.1 JWTs when it checks credentials and receives disclosures and identification presentations. Credentials are classified by a stricter shared decoder ([#919](https://github.com/LFDT-Verii/core/pull/919)) and must be signed with ES256K, ES256 or RS256.

### [#1066](https://github.com/LFDT-Verii/core/pull/1066) Only trust self-signed issuers bound to their signing key

A credential signed with an embedded key is reported as `SELF_SIGNED` only when its issuer is the `did:jwk` derived from that key. Credentials with an unbound embedded key report `TRUSTED_ISSUER: FAIL`, and a `did:jwk` key that doesn't control the claimed issuer reports `DATA_INTEGRITY_ERROR`.

### [#1151](https://github.com/LFDT-Verii/core/pull/1151) Import tenant keys from JWKs

Tenant creation and key import accept `jwk` and `publicJwk` and use them in preference to the hex `key`, `hexKey` and `publicKey` members, so a webhook receiver that forwards Registrar `create_tenant` keys unchanged imports the JWK. A key sent in both forms must encode the same key.

### [#1110](https://github.com/LFDT-Verii/core/pull/1110) Check that tenant keys form a key pair

Creating a tenant or adding a tenant key checks that each private key matches its own public part and any supplied `publicKey`. Keys that can't be imported or used to sign return 400 instead of 500, including on Node.js 24.22 and later ([#1125](https://github.com/LFDT-Verii/core/pull/1125)).

### [#928](https://github.com/LFDT-Verii/core/pull/928) Issue credentials for ES256 credential types

Credential types whose registry metadata sets `defaultSignatureAlgorithm` to `ES256` are signed with a P-256 key and anchored with COSE-key metadata, so their issuance no longer fails at anchoring. Types without a default keep secp256k1 signing with hex metadata ([#926](https://github.com/LFDT-Verii/core/pull/926)).

### [#1061](https://github.com/LFDT-Verii/core/pull/1061) Verify issuer metadata signed with P-256 keys

The trusted-issuer check verifies credential metadata with the issuer's published DID-document JWK, so issuers using P-256 keys pass. Verification methods are matched by their exact DID URL ([#1065](https://github.com/LFDT-Verii/core/pull/1065)).

### [#1160](https://github.com/LFDT-Verii/core/pull/1160) Start with current Fastify serializers

The issued-credentials and offers response schemas merge cleanly with the shared offer schema, so the agent starts when its dependencies resolve fast-json-stringify 7.2 or later.

### [#1095](https://github.com/LFDT-Verii/core/pull/1095) Keep secrets out of logs

The `Server Configured` startup log lists only the names of configured settings, and outbound HTTP client logs redact `Authorization`, `Cookie` and `Set-Cookie` headers ([#1021](https://github.com/LFDT-Verii/core/pull/1021)). Tenant and key import request bodies are no longer logged at debug level ([#1151](https://github.com/LFDT-Verii/core/pull/1151)).

### [#1115](https://github.com/LFDT-Verii/core/pull/1115) Tag Sentry events with the reporting server

Sentry events from the Credential Agent and Mock Vendor carry a `service` tag naming the server. `SENTRY_DSN` and `ENABLE_SENTRY_DEBUG` are read by the shared configuration, and Mock Vendor no longer requires `SENTRY_DSN` ([#1119](https://github.com/LFDT-Verii/core/pull/1119)).

### [#1083](https://github.com/LFDT-Verii/core/pull/1083) Pick the newest feed when token grants tie

When two feeds match an `authorization_code` or `refresh_token` grant with the same `updatedAt`, the agent picks the most recently inserted feed and updates that feed's timestamps.

## Backward incompatibilities

- Identification with `AUTO_IDENTITY_CHECK=false` rejects credentials that fail the tamper check with 401 `presentation_credential_failed_tampered` instead of forwarding them to the vendor.
- Credentials signed with an embedded key not bound to their issuer, including Career Wallet self-reported credentials, report `TRUSTED_ISSUER: FAIL` instead of `SELF_SIGNED` in `check-credentials` results and vendor disclosure payloads. A `did:jwk` key that doesn't match the issuer, or a `kid` that matched only when ignoring case, reports `DATA_INTEGRITY_ERROR`.
- Credential checks reject VC 1.1 credentials with a string `@context` or one whose first entry isn't the VC 1.1 context, a protected `typ` other than `JWT`, a payload over 1 MiB, JSON nested deeper than 32 levels, or both `vc` and `vp` claims. A rejected credential fails the whole request, and requests with more than 100 credentials are rejected.
- VC 1.1 credentials signed with an algorithm other than ES256K, ES256 or RS256 report `UNTAMPERED: FAIL`.
- Trusted-issuer checks no longer fall back to a JWK embedded in the issuer credential header and accept only ES256 or ES256K metadata keys.
- Tenant and key imports return 400 `public_key_not_matched` when a supplied `publicKey` doesn't match the private key, 400 when a JWK's `x`/`y` don't belong to its `d` or a `publicKey` isn't a valid public point, and 400 `key_formats_mismatch` when hex and JWK forms of a key disagree. A forwarded `publicJwk` is not stored on the key record.
- The `Server Configured` startup log reports configuration names instead of values.
