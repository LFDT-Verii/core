## Changes

### [#958](https://github.com/LFDT-Verii/core/pull/958) Recover automatically from failed organization registrations

Registrar now keys Fineract clients and accounts by the organization's Mongo ID instead of its DID, so long DIDs no longer exceed Fineract's external ID limit. When any provisioning step fails during registration (Fineract, Auth0, KMS, or blockchain), the organization is soft deleted and its group is cleaned up, so it is hidden from every retrieval endpoint and the customer can register again. Organizations left partial by earlier failures are still listed by `GET /organizations/full` with an empty `permittedVelocityServiceCategory`; a migration for those records is tracked in [#959](https://github.com/LFDT-Verii/core/issues/959).

### [#928](https://github.com/LFDT-Verii/core/pull/928) Support ES256 credential anchoring

`@verii/verii-issuing` resolves and validates each offer's signing algorithm before any durable side effect and anchors ES256 credentials with P-256 keys and COSE key metadata. The existing SECP256K1 legacy-HEX and RS256 COSE paths are unchanged, and Credential Agent behavior is preserved by resolving missing metadata to SECP256K1.

### [#920](https://github.com/LFDT-Verii/core/pull/920) Verify W3C VC 2.0 JOSE credentials

`@verii/verii-verification`, `@verii/vc-checks`, and `@verii/jwt` verify direct VC 2.0 `vc+jwt` credentials alongside the legacy VC 1.1 JWT envelope. Verification separates proof, conformance, and Velocity policy checks; normative violations fail, while SHOULD-level guidance is reported as warnings.

### [#919](https://github.com/LFDT-Verii/core/pull/919) Add a strict credential envelope codec

`@verii/jwt` exposes `decodeCredentialEnvelope`, which classifies a compact JWS as legacy nested VC 1.1 or direct VC 2.0, applies bounded parsing before signature verification, and provides neutral accessors for credential ID, issuer, subject, type, status, schema, and validity. The existing `decodeCredentialJwt` and `verifyCredentialJwt` exports remain available and delegate to the codec.

## Backward incompatibilities

- `@verii/fineract-client` `createFineractClient` reads `_id` and `profile` from the organization argument instead of `didDoc` and `profile`, and throws when `_id` is missing.
- Fineract clients and accounts created for new organizations use `registrar:org:<mongoId>` external IDs. Existing organizations keep their DID-based external IDs; nothing in the platform reads Fineract by external ID.
