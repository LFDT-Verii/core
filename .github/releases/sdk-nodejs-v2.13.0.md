## Changes

### [#1205](https://github.com/LFDT-Verii/core/pull/1205) Adopt the Platform 1.4 verification baseline

The Node.js wallet SDK now publishes against `@verii/vc-checks` 1.4.0 and `@verii/http-client` 1.4.0. `@verii/vc-checks` reports a revocation registry that can't be read as `DEPENDENCY_RESOLUTION_ERROR` instead of `FAIL`, and leaves credential contents out of its logs. The issuer check the SDK runs when finalizing offers is unchanged.

## Backward incompatibilities

None.
