## Changes

### [#688](https://github.com/LFDT-Verii/core/pull/688) Unified SDK error taxonomy

Introduces the Node.js wallet SDK implementation of the unified cross-platform error taxonomy used by the Velocity Network SDKs. SDK failures now surface stable semantic `VCLErrorCode` values for link validation, request fetching, DID resolution, registration checks, request validation, and request authorization, including `invalid_link`, `connectivity_failure`, `client_request_unauthorized`, `client_request_rejected`, issuer/verifier DID resolution failures, issuer/verifier registration failures, issuer/verifier request validity and authorization failures, and the `sdk_error` fallback.

`VCLError` now includes `sourceErrorCode`, `validationPhase`, `requestDid`, `requestUri`, and `requestKind` for request-level diagnostics. `VCLInitializationDescriptor` also adds `errorCodeCompatibilityMode`, which defaults to `taxonomy` and can be set to `legacy` for integrations that need the previous error codes.

### [#686](https://github.com/LFDT-Verii/core/pull/686) Error taxonomy compatibility baseline

Adds backward-compatibility coverage for the Node.js SDK error taxonomy contract and documents the expected differences between Node.js and the mobile SDK implementations where platform networking, URL parsing, or response handling differs.

### [#691](https://github.com/LFDT-Verii/core/pull/691) Legacy compatibility mapping hardening

Tightens the compatibility mapping so taxonomy-classified failures can be converted back to the previous Node.js SDK error-code behavior when `errorCodeCompatibilityMode` is set to `legacy`.

### [#692](https://github.com/LFDT-Verii/core/pull/692) Shared taxonomy integration coverage

Moves the taxonomy contract coverage into a shared integration test harness, expands request validation and registration-check coverage, adds `registration_check_inconclusive`, validates verified-profile response shapes, and makes malformed JWTs fail during strict decode instead of continuing to a later resolution or lookup failure.

## Backward incompatibilities

By default, the Node.js wallet SDK now returns the new taxonomy error codes with validation-phase and request-context fields on `VCLError`. Set `errorCodeCompatibilityMode: 'legacy'` on `VCLInitializationDescriptor` to preserve the previous error-code behavior while migrating.
