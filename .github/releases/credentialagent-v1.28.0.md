## Changes

### [#768](https://github.com/LFDT-Verii/core/pull/768) Use JWK blockchain private keys directly

Credential Agent blockchain operations can pass private JWKs directly through the shared contract packages. The release also adopts ethers-backed account generation and removes the need for callers to maintain parallel JWK and hex representations.

### [#764](https://github.com/LFDT-Verii/core/pull/764) Use native Node.js key conversion

secp256k1 JWK and hex conversion now comes from `@verii/crypto` and native Node.js crypto APIs. Compatibility wrappers remain available through `@verii/jwt`.

### [#550](https://github.com/LFDT-Verii/core/pull/550) Align Docker and E2E flows with pnpm

Credential Agent and Mock Vendor container workflows now install and run with the repository's pnpm workspace and lockfile, keeping local Docker, E2E, and CI dependency resolution consistent.

## Backward incompatibilities

None.
