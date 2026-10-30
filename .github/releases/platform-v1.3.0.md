## Changes

### [#919](https://github.com/LFDT-Verii/core/pull/919) Decode credentials strictly

`@verii/jwt` adds a strict, size-limited credential envelope decoder and verifier that reject malformed or contradictory credentials before any key is used, and `@verii/verii-verification` and `@verii/vc-checks` use them for VC 1.1 JWTs. Each verification result reports the credential's `dataModelVersion`, `envelopeFormat` and `signingAlgorithm`. Verification of W3C VC 2.0 `vc+jwt` credentials ([#920](https://github.com/LFDT-Verii/core/pull/920)) is included but not yet officially supported.

### [#1066](https://github.com/LFDT-Verii/core/pull/1066) Bind self-signed issuers to their signing key

A credential is reported as `SELF_SIGNED` only when its issuer is the `did:jwk` of the key that verified it, closing an issuer-impersonation gap. Verification methods are matched by their exact DID URL ([#1065](https://github.com/LFDT-Verii/core/pull/1065)), and trusted-issuer checks use the verification method's published `publicKeyJwk`, so organizations with P-256 keys verify correctly ([#1061](https://github.com/LFDT-Verii/core/pull/1061)).

### [#928](https://github.com/LFDT-Verii/core/pull/928) Issue and anchor ES256 credentials

`@verii/verii-issuing` signs and anchors credentials with ES256K, ES256 or RS256 keys, using COSE-key metadata for every algorithm other than secp256k1. Callers can pass per-offer signing algorithms resolved from a tenant signing policy ([#926](https://github.com/LFDT-Verii/core/pull/926)) with the new `CredentialSigningAlgorithms` and `getCredentialSigningProfile` exports.

### [#1146](https://github.com/LFDT-Verii/core/pull/1146) Return Registrar organization keys as hex or JWK

The Registrar create-organization, add-key and get-key endpoints accept `key_encoding=hex|jwk`, with `hex` remaining the default. The Registrar can also generate P-256 issuing and exchange keys behind the `ES256_ORGANIZATION_KEYS` flag ([#1143](https://github.com/LFDT-Verii/core/pull/1143)), which is off by default and should stay off until agents and CAOs support ES256.

### [#1151](https://github.com/LFDT-Verii/core/pull/1151) Let CAOs receive tenant keys as JWKs

`create_tenant` messages can carry organization keys as JWKs, and CAOs can declare the key algorithms and encodings they accept in their ack to the `test` message. The service that sends `create_tenant` builds each key with the new `buildCaoKeyTransfer`, which sends keys other than secp256k1 only as JWKs, and only to CAOs that accept them. `@verii/jwt` adds `resolveTransferredKey`, `isMatchingKeyPair` and `publicJwkFromPrivateJwk` for importing transferred keys ([#1110](https://github.com/LFDT-Verii/core/pull/1110)).

### [#1076](https://github.com/LFDT-Verii/core/pull/1076) Reject did:web documents that don't match the requested DID

`@verii/did-web` rejects a resolved document whose `id` differs from the requested DID, as DID Core requires. Resolution errors give a short reason without exposing network addresses or response contents.

### [#1168](https://github.com/LFDT-Verii/core/pull/1168) Resolve the Registrar's custodied did:web DIDs from its database

The Registrar's `resolve-did` and `resolve-kid` endpoints read `did:web` DIDs under `CUSTODIED_DID_WEB_HOST` from the organizations collection, the source of the Registrar's `did.json` route, instead of fetching the Registrar's own `did.json` over HTTPS. Resolving those DIDs no longer stalls or fails when that network path is slow.

### [#1095](https://github.com/LFDT-Verii/core/pull/1095) Keep secrets out of logs

The `Server Configured` startup log lists only the names of configured settings, never their values. `@verii/logger` also redacts authorization and cookie headers logged by `@verii/http-client` ([#1021](https://github.com/LFDT-Verii/core/pull/1021)) and private key material in JWK and hex form ([#1146](https://github.com/LFDT-Verii/core/pull/1146), [#1151](https://github.com/LFDT-Verii/core/pull/1151)).

### [#1115](https://github.com/LFDT-Verii/core/pull/1115) Tag Sentry events with the reporting server

Servers built on `@verii/server-provider` and the Registrar endpoint packages tag each Sentry event with a `service` name. `SENTRY_DSN` and `ENABLE_SENTRY_DEBUG` are read by the shared configuration ([#1119](https://github.com/LFDT-Verii/core/pull/1119)), and `@verii/error-aggregation` moves to Sentry 11 while still keeping request bodies, cookies and user details out of events ([#1039](https://github.com/LFDT-Verii/core/pull/1039)).

### [#958](https://github.com/LFDT-Verii/core/pull/958) Recover automatically from failed organization registrations

First shipped in Platform 1.2.1. When any Registrar provisioning step fails during registration, the organization is soft deleted and its group cleaned up so the customer can register again, and Fineract clients are keyed by the organization's Mongo ID so long DIDs no longer exceed Fineract's external ID limit.

### [#972](https://github.com/LFDT-Verii/core/pull/972) Pick up dependency security fixes

`@verii/http-client` takes undici 7.30.1 and `@verii/rest-queries` takes the qs 6.16 security fixes ([#957](https://github.com/LFDT-Verii/core/pull/957)). `@verii/crypto` no longer installs the unused `cborg` and `bigint-crypto-utils` packages ([#1072](https://github.com/LFDT-Verii/core/pull/1072), [#1082](https://github.com/LFDT-Verii/core/pull/1082)).

### [#1088](https://github.com/LFDT-Verii/core/pull/1088) Use custom blockchain credentials on test servers

The VNF client authentication plugin in `@verii/base-contract-io` now replaces an existing `vnfBlockchainAuthenticate` stub, so custom blockchain credentials are used on test servers too.

### [#1113](https://github.com/LFDT-Verii/core/pull/1113) Convert alpha-2 country codes to alpha-3

`@verii/country-data` exports `alpha2ToAlpha3`, the reverse of the existing `alpha3ToAlpha2`.

## Backward incompatibilities

- Platform packages and CLIs require Node.js 22.12 or later. Dependencies such as commander 15, canonicalize 5 and nanoid 6 no longer support Node.js 20.
- `@verii/verii-issuing` `issueVeriiCredentials` and `signVeriiCredentials` take a new `credentialSigningAlgorithms` argument before `context`. Callers without resolved algorithms must pass `undefined`.
- `@verii/verii-issuing` allocates COSE-key metadata lists, not hex lists, for credential types without a `defaultSignatureAlgorithm` when the caller passes no algorithm. Pass `SECP256K1` explicitly to keep using existing hex lists.
- `@verii/vc-checks` `checkHolder` takes `dataModelVersion` as a new first argument.
- `@verii/jwt` `verifyCredentialJwt` throws `CredentialVerificationError` or `CredentialEnvelopeError` with a `code` instead of jose errors.
- Credential verification rejects VC 1.1 credentials with a `typ` other than `JWT`, a `vc.@context` that is not an array starting with the VC 1.1 context, an `alg` other than ES256K, ES256 or RS256, or an `alg` that doesn't match the key. A rejected credential fails the whole `verifyCredentials` call, and calls with more than 100 credentials are rejected.
- Credentials signed with an embedded key not bound to their issuer, including `verifgen credential --self-sign` output, now report `TRUSTED_ISSUER: FAIL` instead of `SELF_SIGNED`; a `did:jwk` key that doesn't match the issuer reports `DATA_INTEGRITY_ERROR`. A `kid` that matched only when ignoring case also reports `DATA_INTEGRITY_ERROR`.
- Trusted-issuer checks no longer fall back to a JWK embedded in the issuer credential header. The bound issuer credential's `kid` must be in the issuer's DID document and use ES256 or ES256K.
- `@verii/did-web` rejects documents whose `id` isn't exactly the requested DID, including percent-encoding case and query strings. Bring-your-own did:web organizations with a mismatched hosted document get 400 from Registrar registration, key and service operations and 404 from `resolve-did` and `resolve-kid`.
- Registrar `resolve-kid` with `format=hex` (the default) or `format=base58` returns 400 `public_key_format_not_supported` for keys that aren't secp256k1; use `format=jwk`. Stored compressed `publicKeyHex` values are returned as uncompressed `04…` hex.
- `@verii/components-organizations-registrar` requires `react-router` exactly `7.18.4` as a peer.
- `@verii/country-data` `getCountries` takes calling codes from country-codes-list 3, so North American Numbering Plan territories report `+1` instead of their area code (for example Jamaica changes from `+876` to `+1`).
- The `Server Configured` startup log reports `configuredSettings` names instead of configuration values.
- Carried from Platform 1.2.1: `@verii/fineract-client` `createFineractClient` reads `_id` and `profile` from the organization and throws when `_id` is missing, and new organizations get `registrar:org:<mongoId>` Fineract external IDs.
