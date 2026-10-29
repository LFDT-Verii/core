## Changes

### [#972](https://github.com/LFDT-Verii/core/pull/972) Adopt the Platform 1.3 HTTP client baseline

The Node.js wallet SDK now publishes against `@verii/http-client` 1.3.0, which moves to undici 7.30.1 for its security fixes.

### [#919](https://github.com/LFDT-Verii/core/pull/919) Adopt the Platform 1.3 verification baseline

The SDK now publishes against `@verii/vc-checks` 1.3.0, aligning its dependencies with the platform's stricter credential decoding. The issuer check the SDK runs when finalizing offers is unchanged.

### [#1070](https://github.com/LFDT-Verii/core/pull/1070) Generate did:jwk identifiers with canonicalize 5

`generateDidJwk` canonicalizes public JWKs with canonicalize 5. Generated `did:jwk` values are unchanged.

## Backward incompatibilities

None.
