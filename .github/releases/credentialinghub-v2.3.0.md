## Changes

### [#1203](https://github.com/LFDT-Verii/core/pull/1203) Issue to a whole batch of holders from one shared link

`issue-links/refresh` returns one shared link for an issuer service with internal `verifiable_presentation` auth, with no depot in it. Each holder's depot stores the auth values the Hub matches, and `depots/create` returns 409 `auth_values_already_used`, with the existing `depotId`, when a depot of the same service already holds those values. VP auth rules have a `type` and claims path pointer paths, and changing a service's rules or requested types invalidates its existing depots so they can't match someone else.

### [#1204](https://github.com/LFDT-Verii/core/pull/1204) Authenticate shared-link wallets with a verifiable presentation

A wallet that follows a shared link authenticates with a presentation of the service's requested credentials, such as a holder-bound `EmailV1.0`. The Hub verifies the credentials, builds the auth values from the service's rules and binds the exchange to the one depot in that service that holds exactly those values. After that the exchange works like a `preauth` exchange. A dependency outage during the credential checks returns 502 `credential_check_unavailable` instead of a failed check ([#1205](https://github.com/LFDT-Verii/core/pull/1205)).

### [#1201](https://github.com/LFDT-Verii/core/pull/1201) Create depots before their credentials exist

`depots/create` accepts `deferredCredentials` and `expectedCredentialTypes`. While a depot with deferred credentials has nothing to claim, VN API `credential-offers` returns 202 and the wallet waits. `POST /operator/depots/resolve-deferred-credentials` records that the issuer has finished and sends the waiting wallet `NewOffersReady` or `NoOffersFound`, and `depots/get` returns `deferredCredentialsResolvedAt`. `credentials/create` rejects a type the depot doesn't expect with 400 `credential_type_not_expected`.

### [#1194](https://github.com/LFDT-Verii/core/pull/1194) Defer OpenID4VCI issuance for depots with deferred credentials

For a depot with deferred credentials, the OpenID4VCI token lists a `deferred:<type>` identifier for each expected type with nothing to claim. The credential endpoint answers such a request with 202 and a `transaction_id`, and the new `deferred_credential` endpoint returns the credential once the issuer adds it, or `credential_request_denied` once the issuer resolves the depot without one. `OPENID4VCI_DEFERRED_INTERVAL_SECONDS` (default 30) sets the polling interval. OpenID4VCI issuance state is kept in a new `openid4vciTransactions` collection ([#1200](https://github.com/LFDT-Verii/core/pull/1200)).

### [#1278](https://github.com/LFDT-Verii/core/pull/1278) Expire per-depot links

A depot's pre-authorized code expires after the depot's `preauthCodeExpiresIn` (seconds, or `never`), or after `PREAUTH_CODE_EXPIRES_IN_SECONDS`, which defaults to 72 hours. `issue-links/refresh` and `depots/get` return `preauthCodeExpiresAt`. An expired code gets 401 `preauth_code_expired` from VN API authentication and `invalid_grant` from the OpenID4VCI token endpoint. Shared links carry no code and don't expire.

### [#1188](https://github.com/LFDT-Verii/core/pull/1188) Scope credential claims to the holder's depot

OpenID4VCI access tokens carry the holder's depot, and the credential and notification endpoints only see that depot's credentials. VN API `issue-credentials` only approves or rejects claimable credentials in the exchange's depot. A wallet can no longer claim or reject another holder's credentials in the same tenant.

### [#1259](https://github.com/LFDT-Verii/core/pull/1259) Give each VP auth rule a value type and an optional format

Each VP auth rule needs a `valueType` (`string`, `number` or `boolean`), and string rules can set a `valueFormat` (`email` or `e164`). `depots/create` checks each auth value against its rule, so values that could never match a credential are refused when the depot is created.

### [#1258](https://github.com/LFDT-Verii/core/pull/1258) Validate operator requests with shared schemas

The Hub validates issuer services, depots and credentials with the schemas in the new `@verii/credentialing-hub-operator-api` package ([#1253](https://github.com/LFDT-Verii/core/pull/1253)), which state its rules and limits, so a client can validate requests before sending them. `credentials/create-many` lists every invalid item in `errors`, by index and JSON pointer, and still returns the first problem's `errorCode` and `message` ([#1254](https://github.com/LFDT-Verii/core/pull/1254)).

### [#1255](https://github.com/LFDT-Verii/core/pull/1255) Find depots by their auth values

`POST /operator/depots/get` takes the GET's filters in a body and can also find a service's depots by their auth values, up to 1000 tuples per request.

### [#1192](https://github.com/LFDT-Verii/core/pull/1192) Tell the holder when an operator verifies their presentation

`presentations/verify` with `notifyHolder: true` sends the wallet `PresentationVerified`, as the Credential Agent does, and returns the message's status. Revocation messages use the same sender, which refuses `http` push URLs unless `WALLET_MESSAGES_ALLOW_INSECURE_URL` is set for local development.

### [#1196](https://github.com/LFDT-Verii/core/pull/1196) Let wallets decline a presentation request

Wallets can decline a VN API presentation request, with an optional reason, through the `decline_presentation_uri` in the request's metadata. An OpenID4VP `access_denied` response is recorded the same way. The Hub emits `presentation.declined` to receivers that subscribe to it, and `exchanges/get` returns the decline.

### [#1195](https://github.com/LFDT-Verii/core/pull/1195) Let operators delete presentations

`POST /operator/presentations/delete` deletes up to 200 of a tenant's presentations, with their verifications.

### [#1205](https://github.com/LFDT-Verii/core/pull/1205) Report dependency outages in presentation verification

Presentation verification reports `trustedIssuerCheck` or `revocationCheck` as `DEPENDENCY_RESOLUTION_ERROR` when the Registrar or the revocation registry is unavailable. The verification response schema lists exactly the values each check can return.

### [#1206](https://github.com/LFDT-Verii/core/pull/1206) Accept only simple descriptor paths in presentation submissions

VN API presentations and OpenID4VP direct posts must point each descriptor at `$.verifiableCredential[<n>]`, or for a nested descriptor `$` or `$[0]` with a nested `$.verifiableCredential[<n>]`, with `<n>` from `0` to `999`. The Hub reads that entry directly instead of evaluating the path as JSONPath.

### [#1240](https://github.com/LFDT-Verii/core/pull/1240) Configure the network with environment variables

The Hub image no longer presets any network. The operator sets every network value as an environment variable, and the README lists them. `HOST_URL` is required only by processes that serve HTTP, so the standalone notification worker no longer needs it, and `ROOT_PUBLIC_KEY` is no longer needed ([#1238](https://github.com/LFDT-Verii/core/pull/1238)).

### [#1273](https://github.com/LFDT-Verii/core/pull/1273) Show the environment and chain ID on the healthcheck

`GET /` ends with `Environment:` and `Chain ID:` lines, and a server that embeds the Hub can change that description through `configOverrides`. The Sentry environment comes from `ENVIRONMENT_LABEL`, which defaults to the name of the deployment's `NETWORK` (`DevNet`, `TestNet` or `MainNet`), then to `NODE_ENV` ([#1262](https://github.com/LFDT-Verii/core/pull/1262), [#1266](https://github.com/LFDT-Verii/core/pull/1266)).

## Backward incompatibilities

- The Hub image takes no arguments. Hub 2.2.0's `--velocity-devnet`, `--velocity-testnet` and `--velocity-mainnet`, and any other argument, stop it with exit code 64.
- The Hub no longer defaults `RPC_NODE_URL`, `CHAIN_ID`, `REVOCATION_CONTRACT_ADDRESS`, `BLOCKCHAIN_API_AUDIENCE` or `CREDENTIAL_EXTENSIONS_CONTEXT_URL`. Outside tests, it stops at startup when any network value is missing.
- With `NETWORK` set and no `ENVIRONMENT_LABEL`, the Sentry environment becomes `DevNet`, `TestNet` or `MainNet` instead of `NODE_ENV`.
- VP auth rules need a `type`, a `valueType` and claims path pointer paths, at most 10 rules, with `valueIndex` values running 0 to n−1. VP services saved under 2.2.0 aren't migrated: they can't authenticate, and `issuer-services/update` refuses them until their rules are rewritten, which also invalidates their depots.
- Internal VP services need `disclosureRequest.types`, each entry with a `type`, and can't have a `presentationDefinition`. A service that breaks these, or has no rules, gets 400 `request_validation_failed` instead of `service_verifiablePresentationAuthRules_required`.
- A VP service's depot needs exactly one non-blank `authValues` entry per rule.
- Request limits: 1 to 10 `authValues`, none blank; `userReference` and `credentialReference` of 1 to 64 characters; at most 10 `tags` of 1 to 32 characters; at most 1000 `credentials/create-many` items.
- `credentials/create` and `create-many` return 400 `credential_type_not_expected` for a type the depot doesn't expect.
- For every wallet, including those using per-depot `preauth` links, a presentation's `iat` must be at most 10 minutes old and at most 5 minutes ahead, and each `jti` authenticates an exchange once. Other presentations get 401 `unauthorized`.
- Pre-authorized codes expire 72 hours after each `issue-links/refresh` unless the depot sets `preauthCodeExpiresIn`. Codes refreshed before the upgrade work until their next refresh. A deferred depot's wallet authenticates again with the same code, so its lifetime must cover the issuer's processing.
- OpenID4VCI access tokens issued before the upgrade get 401 `invalid_token`. A second credential request for the same `credential_identifier` gets 400 `credential_request_denied` instead of signing the credential again, and a credential signed through OpenID4VCI but not yet accepted can't be claimed through the VN API.
- Wallet messages to an `http` push URL or one containing credentials, and messages answered with a 3xx, return `failed`.
- Presentation descriptor paths in any other form get 400 `presentation_jsonpath_unsupported`.
- Verification results report `DEPENDENCY_RESOLUTION_ERROR` instead of `FAIL` for `trustedIssuerCheck` and `revocationCheck` when a dependency is unavailable, and the response schema no longer lists `UNCHECKED`.
- New non-unique indexes on `depots` and `openid4vciTransactions` are created when the Hub starts. There are no migrations.

## Known issues

- Tenant keys must still be `SECP256K1` ([#746](https://github.com/LFDT-Verii/core/issues/746)), so organizations with P-256 Registrar keys can't be onboarded yet.
- A tenant creation that fails when saving the tenant, such as a repeated request for an existing tenant, leaves that request's keys in the KMS ([#1169](https://github.com/LFDT-Verii/core/issues/1169)).
