## Changes

### [#1240](https://github.com/LFDT-Verii/core/pull/1240) Read every network value from the environment

The agent reads the RPC node, chain ID, contract addresses, token endpoint, OAuth client and `BLOCKCHAIN_API_AUDIENCE` through the shared blockchain configuration, which has no defaults ([#1239](https://github.com/LFDT-Verii/core/pull/1239)). Settings that nothing reads are no longer required: `ROOT_PUBLIC_KEY`, `DEFAULT_WALLET_MOBILE`, `DEFAULT_WALLET_DESKTOP` and `DEFAULT_CA_WALLET_CONFIG`. `PORT` and `HOST` default to `3000` and `0.0.0.0`, and the agent reads `HOST_URL` itself, still requiring it ([#1238](https://github.com/LFDT-Verii/core/pull/1238)). Mock Vendor no longer requires `HOST_URL`, `ADMIN_USER_NAME` or `VNF_HEADER_SIGNATURE_VERIFICATION_KEY`; without the key, its registrar webhook records messages as not verified.

### [#1262](https://github.com/LFDT-Verii/core/pull/1262) Return unsigned JSON with ?format=json in every environment

`get-presentation-request` and `get-credential-manifest` return unsigned JSON for `?format=json` under `NODE_ENV=production` too. The Sentry environment comes from `ENVIRONMENT_LABEL`, which defaults to the name of the deployment's `NETWORK` (`DevNet`, `TestNet` or `MainNet`), then to `NODE_ENV` ([#1266](https://github.com/LFDT-Verii/core/pull/1266)).

### [#1060](https://github.com/LFDT-Verii/core/pull/1060) Report each tenant key's stored encoding

`GET` and `POST /operator-api/v0.8/tenants/:tenantId/keys` return the encoding stored with each key, `jwk` or `hex`, instead of always `hex`.

### [#1206](https://github.com/LFDT-Verii/core/pull/1206) Accept only simple descriptor paths in presentation submissions

Identification and inspection presentations must point each descriptor at `$.verifiableCredential[<n>]`, with `<n>` from `0` to `999`, and the agent reads that entry directly instead of evaluating the path as JSONPath. Operator-configured identity matcher paths are unchanged.

### [#1205](https://github.com/LFDT-Verii/core/pull/1205) Report registrar and ledger outages as dependency errors

Credential checks report `TRUSTED_ISSUER: DEPENDENCY_RESOLUTION_ERROR` when the Registrar's issuer lookups fail for any reason other than a 400 or 404, and `UNREVOKED: DEPENDENCY_RESOLUTION_ERROR` when the revocation registry can't be read. Identification still answers 401 `presentation_credential_bad_issuer` or `presentation_credential_revoked` for those results. Credential contents are no longer logged during verification.

### [#1273](https://github.com/LFDT-Verii/core/pull/1273) Show the environment and chain ID on the healthcheck

`GET /` on the Credential Agent ends with `Environment:` and `Chain ID:` lines, and on Mock Vendor with `Environment:`. Its status and content type are unchanged. `startAppServer`, `startHolderAppServer` and `startOperatorAppServer`, and Mock Vendor's `startAppServer`, take `{ configOverrides }`, so a server that embeds them can change their config, including the deployment description.

## Backward incompatibilities

- Verii no longer defaults any network value. `RPC_NODE_URL` no longer defaults to `http://34.244.131.79:8547`, `CHAIN_ID` to `2020`, `REVOCATION_CONTRACT_ADDRESS` to `0xf755E1Ca66bE12F177178E7Ea696969E0A55Bb64` or `BLOCKCHAIN_API_AUDIENCE` to `https://velocitynetwork.node`. Outside tests, the agent stops at startup when any of these is missing.
- `get-presentation-request` and `get-credential-manifest` return unsigned JSON for `?format=json` in production, where they used to return the signed response.
- With `NETWORK` set and no `ENVIRONMENT_LABEL`, the Sentry environment becomes `DevNet`, `TestNet` or `MainNet` instead of `NODE_ENV`. Set `ENVIRONMENT_LABEL` to keep the old name.
- The tenant key endpoints report `jwk` for keys stored as JWKs, which includes every key the agent imports today, and `hex` only for older keys still stored as hex.
- Identification and inspection presentations whose descriptor `path` isn't `$.verifiableCredential[<n>]` get 400 `presentation_jsonpath_unsupported`.
- `check-credentials` results and vendor disclosure payloads report `DEPENDENCY_RESOLUTION_ERROR` instead of `FAIL` for `TRUSTED_ISSUER` and `UNREVOKED` when the Registrar or the revocation registry is unavailable.
