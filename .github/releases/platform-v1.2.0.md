## Changes

### [#868](https://github.com/LFDT-Verii/core/pull/868) Resolve blockchain OAuth credentials per request

Contract clients can now inject a request-aware VNF OAuth credential resolver while retaining the existing static configuration path. Token caching uses a stable, non-secret resolver key, enabling Credentialing Hub deployments to select CAO-specific blockchain credentials safely.

### [#867](https://github.com/LFDT-Verii/core/pull/867) Delete superseded KMS keys and secrets

`@verii/db-kms` now exposes `deleteKeyOrSecret(keyId)` for generated keys and imported secrets. Callers can clean up replaced or unattached credentials and distinguish an existing deletion from an already-absent key.

### [#866](https://github.com/LFDT-Verii/core/pull/866) Protect sensitive authentication logs

The shared server and logger packages can suppress request and response bodies on sensitive routes while preserving normal debug logging elsewhere. Credential, token, provisioning-code, and KMS identifiers remain redacted at every log level. Additional App Check and account-verification fields are redacted through [#872](https://github.com/LFDT-Verii/core/pull/872).

### [#856](https://github.com/LFDT-Verii/core/pull/856) Search for services awaiting approval

Registrar profile searches can opt into unapproved services with `include-unapproved-services`. Existing consumers retain activated-only results by default, and included services now report their approval state.

### [#830](https://github.com/LFDT-Verii/core/pull/830) Recover interrupted organization registrations

Operators can soft-delete partially created organizations that never reached service activation, allowing customers to register again. Organizations with activated services remain protected from deletion.

### [#806](https://github.com/LFDT-Verii/core/pull/806) Add explicit HTTP error-response and timeout modes

`@verii/http-client` can return 4xx and 5xx responses instead of throwing when configured with `responseErrorMode: 'return'`. Request timeouts now use Undici's native header and body phase timeouts.

### [#768](https://github.com/LFDT-Verii/core/pull/768) Support JWK blockchain private keys

Blockchain and contract packages now accept private JWKs as well as hex keys and provide ethers-backed account generation. The shared crypto package owns the secp256k1 JWK/hex conversion primitives introduced in [#764](https://github.com/LFDT-Verii/core/pull/764).

### [#741](https://github.com/LFDT-Verii/core/pull/741) Keep Mongo repository state consistent across applications

Mongo-backed platform packages now consume the application's Mongo and Spence repository instances as peers, preventing duplicate physical modules from splitting module-level connection and repository state.

### [#840](https://github.com/LFDT-Verii/core/pull/840) Support audience-specific Swagger documents

The shared server package can publish multiple named OpenAPI documents with isolated schemas and security definitions while preserving the existing single-document behavior. Packaged Velocity branding removes the need for external Swagger UI assets.

### [#597](https://github.com/LFDT-Verii/core/pull/597) Stabilize Registrar organization and logout flows

Organization creation is centralized across direct creation, invitations, and service onboarding. Token refresh after organization creation and the logout/auth-resolution fixes from [#575](https://github.com/LFDT-Verii/core/pull/575), [#598](https://github.com/LFDT-Verii/core/pull/598), and [#599](https://github.com/LFDT-Verii/core/pull/599) prevent stale sessions and incorrect redirects.

## Backward incompatibilities

- Mongo-backed package consumers must provide compatible `mongodb` and `@spencejs/spence-mongo-repos` peer dependencies.
- The Registrar `resolve-kid` public-key response no longer supports PEM output. Its default format is now `hex`; supported formats are `hex`, `base58`, and `jwk`.
- `@verii/http-client` `requestTimeout` now represents Undici header and body phase timeouts rather than a strict wall-clock request deadline.
