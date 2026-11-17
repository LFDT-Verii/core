## Changes

### [#1240](https://github.com/LFDT-Verii/core/pull/1240) Read every network value from the environment

`@verii/config` no longer knows any network's values. Servers that use the blockchain spread the new `createBlockchainConfig()`, which reads the RPC node, chain ID, contract addresses, token endpoint, OAuth client and `BLOCKCHAIN_API_AUDIENCE` from the environment, with no defaults ([#1239](https://github.com/LFDT-Verii/core/pull/1239)). Settings that nothing reads, such as `ROOT_PUBLIC_KEY`, are no longer required, `PORT` and `HOST` default to `3000` and `0.0.0.0`, and each server that needs `HOST_URL` reads it itself ([#1238](https://github.com/LFDT-Verii/core/pull/1238)). The `Server Configured` startup log adds the chain ID.

### [#1262](https://github.com/LFDT-Verii/core/pull/1262) Replace NODE_ENV switches with named settings

Behaviour that differed between deployments no longer depends on `NODE_ENV`. `ENVIRONMENT_LABEL` names the deployment in Sentry, Registrar monitor names and Registrar support email subjects, and defaults to the name of the deployment's `NETWORK` (`DevNet`, `TestNet` or `MainNet`), then to `NODE_ENV` ([#1266](https://github.com/LFDT-Verii/core/pull/1266)). The Registrar names the network in its emails from `NETWORK`, and `REGISTRAR_VALIDATE_KYB_PROFILE` and `REGISTRAR_AUTO_ACTIVATE_SERVICES` turn KYB profile validation and automatic service activation on or off, with the defaults `NODE_ENV` gave them. `@verii/config` exports `networkName`.

### [#1253](https://github.com/LFDT-Verii/core/pull/1253) Share the Credentialing Hub's operator API with its clients

The new `@verii/credentialing-hub-operator-api` package holds the Hub's issuer service, depot and credential request schemas, their error codes and its auth value helpers, and `initOperatorApiValidator()` validates requests as the Hub does. The schemas state the Hub's validation rules and limits ([#1258](https://github.com/LFDT-Verii/core/pull/1258)), VP auth rules carry a `valueType` and an optional `valueFormat` checked by `isValidAuthValue` ([#1259](https://github.com/LFDT-Verii/core/pull/1259)), and the package also describes `credentials/create-many` item errors ([#1254](https://github.com/LFDT-Verii/core/pull/1254)), `POST depots/get` requests ([#1255](https://github.com/LFDT-Verii/core/pull/1255)) and depot link lifetimes ([#1278](https://github.com/LFDT-Verii/core/pull/1278)).

### [#1267](https://github.com/LFDT-Verii/core/pull/1267) Load batches of holders into the Credentialing Hub

The new `@verii/batch-issuer` CLI reads a YAML spec and a CSV of holders. `batch-issuer validate` checks every row against the spec, the issuer service, the credential type schemas, the Registrar and the depots already in the Hub, and reports every error ([#1260](https://github.com/LFDT-Verii/core/pull/1260)). `batch-issuer load` then creates the depots and credentials, can resolve waiting deferred credentials, writes each holder's link to a CSV for mail merge, and records its progress so a rerun continues where it stopped. `--preauth-code-expires-in` sets how long per-depot links work ([#1278](https://github.com/LFDT-Verii/core/pull/1278)). `@verii/validation` exports `initAjv2019Validation`, which the CLI shares with the validation plugin ([#1271](https://github.com/LFDT-Verii/core/pull/1271)).

### [#1205](https://github.com/LFDT-Verii/core/pull/1205) Report dependency outages as dependency errors

`@verii/verii-verification` `verifyCredentials` reports `TRUSTED_ISSUER: DEPENDENCY_RESOLUTION_ERROR` when the Registrar's issuer lookups fail for any reason other than a 400 or 404, and `@verii/vc-checks` reports `UNREVOKED: DEPENDENCY_RESOLUTION_ERROR` when the revocation registry can't be read, so callers can tell an outage from a bad credential. `@verii/metadata-registration` `getRevokedStatus` rejects status URLs the registry can't use with `code: 'invalid_revocation_url'`, which is still reported as `FAIL`. Verification no longer logs credential contents.

### [#1268](https://github.com/LFDT-Verii/core/pull/1268) Resend contract transactions whose nonce another sender takes

`@verii/base-contract-io` adds `sendContractTransaction`, which waits for a contract call with replacement detection and sends it again when another transaction from the same account takes its nonce. `@verii/contract-permissions` and the coupon and registry administration calls in `@verii/metadata-registration` use it. Nonce reads skip the provider cache, and a provider without a configured chain ID asks the node once.

### [#1273](https://github.com/LFDT-Verii/core/pull/1273) Show the environment and chain ID on healthchecks

`@verii/config` adds `describeDeployment` and `deploymentDescription`, which servers append to their `GET /` response as `Environment:` and `Chain ID:` lines. The credential types Registrar's healthcheck shows them. The organizations Registrar's pubsub subscribers receive the server's config as it is, so a config that holds functions no longer stops them ([#1275](https://github.com/LFDT-Verii/core/pull/1275)).

### [#1281](https://github.com/LFDT-Verii/core/pull/1281) Let a server add its own log redact paths

`@verii/logger` `loggerProvider` takes `logRedactPaths`, and `@verii/server-provider` passes the server config's `logRedactPaths`, so a server can redact fields only it logs along with the shared paths.

### [#1256](https://github.com/LFDT-Verii/core/pull/1256) Build agent holder URLs and wallet deep links

`@verii/common-functions` adds `buildAgentHolderUrl` and `buildDeepLink`, which the Credential Agent and the Credentialing Hub now use to build their links. Their links are unchanged.

### [#1225](https://github.com/LFDT-Verii/core/pull/1225) Send new Registrar invitees to set their password

`@verii/components-organizations-registrar` sends an invitee without an account to the Auth0 page that sets their password, instead of showing a spinner forever. It follows the invitation's `signup_url` only when it is an `https` URL on the configured Auth0 domain.

### [#1063](https://github.com/LFDT-Verii/core/pull/1063) Reject unsupported curves in COSE keys

`@verii/cose-key` `toJwk` and `fromJwk` map only secp256k1 and P-256 keys and throw for any other or malformed curve, instead of encoding it as P-256. `@verii/cose-key` moves to cborg 6.2.1 ([#1191](https://github.com/LFDT-Verii/core/pull/1191)), the `@verii/db-kms` `KeySpec` type lists `P-521` instead of `P-512` ([#1052](https://github.com/LFDT-Verii/core/pull/1052)), and `@verii/tests-helpers` `privateJwkMatcher` expects `kty: 'RSA'` for RSA keys ([#1059](https://github.com/LFDT-Verii/core/pull/1059)).

## Backward incompatibilities

- Verii no longer defaults any network value. Outside tests, `createBlockchainConfig()` requires `RPC_NODE_URL`, `CHAIN_ID`, `COUPON_CONTRACT_ADDRESS`, `METADATA_REGISTRY_CONTRACT_ADDRESS`, `PERMISSIONS_CONTRACT_ADDRESS`, `REVOCATION_CONTRACT_ADDRESS`, `VNF_OAUTH_TOKENS_ENDPOINT` and `BLOCKCHAIN_API_AUDIENCE`. The Registrar and event processing packages no longer default the RPC node to `http://34.244.131.79:8547` or the chain ID to `2020`, and now require `REVOCATION_CONTRACT_ADDRESS`. `BLOCKCHAIN_API_AUDIENCE` no longer defaults to `https://velocitynetwork.node`.
- `@verii/config` `genericConfig` no longer has `hostUrl`, `blockchainApiAudience`, `rootPublicKey` or `idCredentialTypes`, and the `abi` export is gone. Servers that use `HOST_URL` read it themselves, and blockchain clients spread `createBlockchainConfig()`.
- The organizations Registrar requires `NETWORK`. Its emails name the network from it (`devnet` as `DevNet`, `testnet` as `TestNet`, `mainnet` as `MainNet`), and the network name prefixes the invitation, organization-created and signatory reminder subjects only on `devnet` and `testnet`.
- `REGISTRAR_VALIDATE_KYB_PROFILE` and `REGISTRAR_AUTO_ACTIVATE_SERVICES` replace the Registrar's `NODE_ENV` switches. Under `NODE_ENV=production` they default to validating KYB profiles and not activating services, so a deployment off mainnet that moves to `NODE_ENV=production` must set them to keep its behaviour.
- With `NETWORK` set and no `ENVIRONMENT_LABEL`, the Sentry environment, new Registrar monitor names and Registrar support email subject prefixes become `DevNet`, `TestNet` or `MainNet`, and are no longer upper-cased. Set `ENVIRONMENT_LABEL` to keep the old names. Existing monitors keep their names.
- `verifyCredentials` reports `DEPENDENCY_RESOLUTION_ERROR` instead of `FAIL` for `TRUSTED_ISSUER` when a Registrar issuer lookup fails other than with a 400 or 404, and for `UNREVOKED` when the revocation registry can't be read. `@verii/vc-checks` `CredentialStatus` gains `INVALID`.
- `@verii/metadata-registration` `getRevokedStatus` throws an error with `code: 'invalid_revocation_url'` for an unusable status URL or a reverted registry call.
- `@verii/common-fetchers` `getCredentialTypeDescriptor` rethrows a non-404 error that carries its status on `error.response`, instead of returning the basic descriptor.
- `@verii/cose-key` `toJwk` throws `Unsupported COSE EC2 Curve (crv)` and `fromJwk` throws `Unsupported JWK EC Curve (crv)` for curves other than secp256k1 and P-256, which were encoded as P-256 before.
