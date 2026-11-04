# Shared Issue Link with Email Authentication Design

Issue: [#1202](https://github.com/LFDT-Verii/core/issues/1202). Code references are to `main` at `0d69c19b`.

## Summary

A `verifiable_presentation` issuer service gets one issue link that serves a
whole batch. The wallet presents an email credential to `/authenticate`. The
Hub checks the credential, finds the one depot in the service whose
`authValues` equal the values the service's rules read from it, and binds the
exchange to it. After that, the
exchange carries on exactly as a `preauth` exchange does: the access token,
`credential-offers` and `issue-credentials` don't change.

The work is two PRs. PR 1 lets the Hub find a depot by email and returns the
shared link. PR 2 adds the authentication handler.

## Goals

- One stable link per `verifiable_presentation` service, with the same shape
  as the Credential Agent's batch link, so Velocity wallets need no change.
- A person added after the link was handed out can claim with it.
- Only a holder who presents a trusted, unrevoked, unexpired email credential
  bound to their own key gets a depot's credentials.
- Email matching ignores case and works on MongoDB, Amazon DocumentDB and
  Azure DocumentDB.
- An email-only check costs the issuer no verification vouchers.

## Non-goals

- OpenID4VCI. The Hub supports only the pre-authorized grant. Presenting a
  credential during OpenID4VCI issuance needs an authorization-code flow with
  an OpenID4VP step.
- Storing the presented credentials. Authentication only reads the email.
- Searching depots by email through `depots/get`.
- Merging several depots into one exchange.
- Rate-limiting manifest requests on public links.

## What exists today

| Piece | Where | State |
| --- | --- | --- |
| Service fields `authMethods`, `authMode`, `disclosureRequest`, `verifiablePresentationAuthRules` | `controllers/operator/issuer-services/schemas/new-issuer-service.schema.js` | Done. `rule` is `pick` or `equal`. `path` is an array of JSONPaths. |
| Rules required for VP services | `entities/issuer-services/domain/validate-issuer-service.js:9` | Done, when `authMode === 'internal'` |
| `authValues` required for VP depots | `entities/depots/domain/validate-depot.js:28` | Done, same condition |
| Manifest asks for `disclosureRequest` types, `submit_presentation_uri` is `/authenticate` | `entities/exchanges/domain/build-presentation-request.js:22` | Done |
| Presentation definition id is `<exchangeId>.<serviceId>` | `build-presentation-request.js:105` | Done |
| Link without a depot has no `vendorOriginContext` | `entities/links/domain/build-vn-api-issuing-link.js:41` | Done |
| `/authenticate` verifies the VP JWT signature | `controllers/vn-api/vn-issuing-controller.js:166` | Done |
| `/authenticate` validates the VP against the submission schema | `vn-issuing-controller.js:169` | **No-op.** Fastify's `req.validateInput` returns a boolean, and the result is ignored. |
| Submission checked against the exchange | `entities/presentations/domain/validate-presentation.js` | Done, used by relying-party `postPresentation` |
| Credential checks | `entities/presentations/orchestrators/verify-presentation.js:57` | Done, inline in `verifyPresentation` |
| VP auth in `authenticate()` | `entities/exchanges/orchestrators/authenticate.js:41` | **Missing.** Throws `authentication_method_unsupported`. |

## Flow

```text
Operator                         Hub                                     Wallet
--------                         ---                                     ------
issuer-services/create (VP) ---> stores rules, disclosureRequest
depots/create {authValues} ----> stores authMatchValues, 409 on reuse
issue-links/refresh (no depot) > shared vnProtocolLink, redirectUrl
                                                                <------- scans QR
                                 GET  get-credential-manifest?id=<svc>
                                      new exchange, manifest asks for
                                      EmailV1.0 ----------------------->
                                                                <------- POST authenticate
                                 1. holder DID from the VP's kid              {exchange_id, jwt_vp}
                                 2. validatePresentation (binds the VP
                                    to this exchange and service)
                                 3. pick credentials of the requested types
                                 4. checkCredentials
                                 5. build candidate tuples, find
                                    one depot in one query
                                 6. AUTHENTICATION_SUCCESS {depotId},
                                    access token --------------------->
                                 credential-offers, issue-credentials
                                 unchanged
```

## 1. Finding a depot by email (PR 1)

### Services and auth methods

An issuer service's `authMethods` can be `preauth`, `verifiable_presentation`
or both. `isInternalVpAuth(service)` is
`authMode === 'internal' && authMethods.includes('verifiable_presentation')`.
It lives in `entities/issuer-services/domain/is-internal-vp-auth.js`, and
`validateDepot`, `validateIssuerService`, `createDepot`, the links and
`authenticate()` all use it.

**Both methods stay supported.** Each Hub issuer service needs its own service
entry in the issuer's DID document. An issuer that wants personal links and a
batch link would otherwise need a second service on the registrar.

A service with both methods counts as an internal VP service for depots. Its
depots get the `authValues` validation, `authMatchValues` and the 409 check,
like any VP service's.

### Rules and `authValues`

A depot's `authValues` holds exactly one value per rule, at the rule's
`valueIndex`, and nothing else. For example, with an email rule at
`valueIndex` 0 and an employee ID rule at 1, a depot's `authValues` is
`['jane.doe@example.com', 'EMP-1']`.

- **`validateIssuerService`**, for an internal VP service, keeps the existing
  check that rules exist (400
  `service_verifiablePresentationAuthRules_required`). It also requires the
  rules' `valueIndex` values to be exactly 0 to n−1, each used once, in any
  order. A gap, a duplicate, a negative index or an index out of range returns
  400 `service_verifiablePresentationAuthRules_invalid`
  (`IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID`). This applies to
  `create` and `update`.
- **`validateDepot`**, for an internal VP service, requires
  `authValues.length === rules.length` and that every normalized value is
  neither null nor an empty string. A blank string is empty once trimmed.
  Numbers and booleans are allowed. Otherwise it returns 400
  `invalid_auth_values`. Empty or missing `authValues` also fail, which covers
  a service stored without rules.

### `authMatchValues`

`depots/create` stores a normalized copy of `authValues` as
`authMatchValues`, in the same order, on depots of internal VP services:

```js
// entities/depots/domain/auth-match-values.js
const toAuthMatchValue = (value) =>
  isString(value) ? value.trim().toLowerCase() : value;

const buildAuthMatchValues = map(toAuthMatchValue);
```

- **Internal VP services only.** Depots of `preauth`-only services and of
  relying-party services don't get `authMatchValues`.
- **Strings only.** Numbers and booleans are kept as they are. A number in
  `authValues` doesn't match a string in a credential.
- **Trim as well as lower-case.** The issue specifies lower-casing only.
  Trimming also stops a space pasted from a spreadsheet from silently breaking
  one person's claim. Credential values go through the same function, so the
  two sides always agree.
- **Never returned.** `authMatchValues` goes into the repo's
  `defaultProjection`, because the authentication handler needs it. The
  `depot` response schema doesn't declare it, so the serializer drops it from
  `depots/create` and `depots/get` responses.

There is no depot update endpoint, so `depots/create` is the only writer.

### Index

`entities/depots/repo/repo.js` creates the index on ready, next to the
existing `preauthCodeHash` index:

```js
await mongoDb()
  .collection('depots')
  .createIndex({ tenantId: 1, serviceId: 1, authMatchValues: 1 });
```

`authMatchValues` is the only array in the index, so it's a plain multikey
index with no collation, supported by MongoDB, Amazon DocumentDB and Azure
DocumentDB. For a
whole-array match, MongoDB uses the index to find the tuple's first element,
then compares the whole array on the documents it fetches.

### Lookup by tuple

```js
// entities/depots/repo/find-depots-by-auth-match-tuples.js
findDepotsByAuthMatchTuples: (serviceId, tuples) =>
  parent.find({
    filter: {
      serviceId: new ObjectId(serviceId),
      authMatchValues: { $in: tuples },
    },
  }),
```

Each tuple is an array, so `$in` compares whole arrays. A depot matches only
if its `authMatchValues` equals one of the tuples exactly, in order. A depot
with the same value at another position, or with an extra element, doesn't
match. Nothing is matched in memory.

`multitenantExtension` adds `tenantId`. Both `depots/create` and the
authentication handler use this function.

### One depot per tuple per service

`createDepot`, for an internal VP issuer service only:

1. `authMatchValues = buildAuthMatchValues(authValues)`.
2. `findDepotsByAuthMatchTuples(serviceId, [authMatchValues])`.
3. If it finds a depot, throw 409 `auth_values_already_used` with
   `depotId: <existing depot id>` on the error.

The whole tuple must be unique, not each value. With an email-only rule,
that's one depot per email. Depots of `preauth`-only services and of
relying-party services skip the check.

**Return `errorCode` and `depotId` in the 409 body.** The `depots/create`
route declares no 409 response. When Fastify finds no schema for the status
code, its fallback serializer emits only `statusCode`, `code`, `error` and
`message`, so `errorCode` and `depotId` would be lost.
`...fastify.ConflictResponse` isn't enough either: Fastify serializes the
error through `Object.create(error, ...)`, so the shared `error` schema's
`additionalProperties: true` sees no own properties, and only declared fields
survive. The route declares 409 as `depot-conflict-error`, the `error` schema
plus a `depotId` property, so both fields reach the client.

**Concurrent duplicate creates are accepted.** Two concurrent creates of the
same tuple can both pass the check. Authentication fails closed: it finds two
depots, returns 401 and logs both IDs. Operators who load a batch in parallel
should dedupe it first. The operator docs say so.

**Rule changes aren't handled.** If a service's rules change after depots
exist, or a `preauth` service becomes a VP service, existing depots aren't
revalidated or rebuilt. Their `authMatchValues` follow the old rules, so they
stop matching, and the operator must re-create them. The operator docs say so.
No code handles this.

### No backfill

This is a new feature. No deployment has used `authValues` or the VP service
fields, so no existing depot needs `authMatchValues`.

## 2. Shared issue link (PR 1)

### Which link

`refreshIssueLinks` (`entities/links/orchestrators/refresh-links.js`):

| Service `authMethods` | `depotId` | Link |
| --- | --- | --- |
| `preauth` only | given | Per-depot `preauth` link, as today |
| `preauth` only | missing | 400 `issue_link_requires_depotId`, as today |
| includes `verifiable_presentation` | missing | Shared link |
| `verifiable_presentation` only | given | Shared link, after checking that the depot exists. The depot changes nothing in the link. |
| both | given | Per-depot `preauth` link |

**A VP-only service ignores the depot.** A link built for one depot would
carry that depot's `credential_types`. Whoever authenticates through it then
sees only their own credentials of those types. Returning the shared link
keeps operators who always pass `depotId` working, with no partial offers.

**A service with both methods** gets per-depot links when given a depot, and
the shared link otherwise. `authenticate()` dispatches on what the VP carries
(see [Dispatch](#dispatch)), so both kinds of link work against the same
service.

Changes:

- **Don't look up a missing depot.** `refreshIssueLinks` loads the depot
  through `optional()`, so only when `depotId != null`. Today it runs
  `findOne({ _id: undefined })`.
- **Validate with both methods in mind.** `validateIssueLink` raises
  `issue_link_requires_depotId` only when
  `isPreauthCodeAuth(service) && !isInternalVpAuth(service)` and there's no
  depot.
- **Choose the link.** `refreshIssueLinks` builds the per-depot `preauth` link
  when `isPreauthCodeAuth(service) && depot != null`, and the shared link
  otherwise.
- **Build the shared link from the service alone.**
  `buildIssuingDeepLink(tenant, service, null, undefined, config.deepLinkProtocol)`.
  It doesn't call `loadCredentialTypeHints` or `refreshPreauthCode`.

### Shape

The shared link is what `buildIssuingDeepLink` already builds without a
depot. `buildDeepLinkUrl` appends `request_uri`, then `issuerDid`, and skips
the null `inspectorDid` and `vendorOriginContext`:

```text
velocity-network://issue
  ?request_uri=https://<hub host>/vn-api/r/<issuer DID>/get-credential-manifest?id=<issuer service ID>
  &issuerDid=<issuer DID>
```

(Shown decoded; `request_uri` is URL-encoded in the real link.)

The response has `vnProtocolLink`, and `redirectUrl` wrapping it for
`/app-redirect`. It has no `preauthCode`. It has no `openidCredentialOffer`,
which needs a pre-authorized code. The link holds no secret, so every refresh
returns the same link. To withdraw it, deactivate the service.

The Hub doesn't render QR codes. The operator encodes `vnProtocolLink`, or
uses `redirectUrl` for a web page.

### The manifest's output descriptors

`getCredentialManifest` takes one list, the `credential_types` query
parameter, and uses it twice. It sets the exchange's `credentialTypes`, which
filters the offers (`findByDepotId`). It also builds the manifest's
`output_descriptors`, which tell the wallet what it will be offered. The
shared link has no `credential_types`, so today the manifest would have no
output descriptors. The agent's batch link has the same gap.

This work leaves them empty. No Velocity client reads `output_descriptors`:
not the iOS SDK, the Android SDK or the holder app. Filling them would mean
splitting the two uses of `credential_types` and adding a registrar lookup to
every manifest request, with nothing to show for it. If another wallet ever
needs them, the service's unused `credentialTypesAvailable` field could
supply them without touching the offer filtering.

## 3. Authentication (PR 2)

### Controller

`POST /r/:tenantId/authenticate` (`controllers/vn-api/vn-issuing-controller.js`):

- Passes the raw `jwt_vp` along with the decoded VP:
  `authenticate(exchange_id, { vp, jwtVp: req.body.jwt_vp }, req)`. The
  handler needs the JWT header's `kid` and the payload's `iss`.
- Removes the `req.validateInput(...)` call. It validates nothing (see
  [What exists today](#what-exists-today)). The VP handler validates through
  `validatePresentation`, which throws. The `preauth` path keeps its current
  behaviour.
- Adds `...fastify.PaymentRequiredResponse` so a 402 keeps its `errorCode`.
  The `5xx` response is already declared.

### Dispatch

There are two cases:

1. Use `preauth` when the service allows it, and either the VP has a
   `vendorOriginContext` or the service has no internal VP auth.
2. Otherwise, use VP auth when the service is internal VP.

Anything else returns 400 `authentication_method_unsupported`.

```js
const selectAuthHandler = (service, vp) => {
  if (
    isPreauthCodeAuth(service) &&
    (vp.vendorOriginContext != null || !isInternalVpAuth(service))
  ) {
    return preauthCodeAuthHandler; // a preauth-only service keeps today's 401 for a missing code
  }
  if (isInternalVpAuth(service)) {
    return vpAuthHandler;
  }
  throw newError(400, ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED, {
    errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
  });
};
```

A service with both methods serves both kinds of link: a per-depot link's VP
carries a `vendorOriginContext`, and a shared link's VP doesn't. Each handler
returns the depot. `authenticate()` then adds `AUTHENTICATION_SUCCESS` with
`{ depotId }`, as it does today.

A service with `verifiable_presentation` but no `authMode: 'internal'` is
unsupported. Nothing outside the Hub could do the matching.

### `vpAuthHandler`

Its inputs are the exchange (already in `AUTHENTICATION_REQUEST`), the
service, `{ vp, jwtVp }` and the request context.

**1. Holder DID.** The controller calls `verifyVerifiablePresentationJwt`
with protocol version 2, which requires a `kid` naming a `did:jwk` and checks
the VP's signature with that key. The holder is the DID part of `kid`:
`holderDid = split('#', jwtDecode(jwtVp).header.kid)[0]`.

The VP must also have an `iss` equal to `holderDid`. A VP with no `iss`, or
with a different one, returns 401 `unauthorized`. The handler reads `iss` from
the JWT payload, not `vp.issuer.id`: when the JWT has no `iss`, the decoder
leaves any `issuer` from inside the `vp` claim in place. This rule is
deliberately strict to start with, and can be relaxed later if a wallet needs
it.

The issue proposes passing the VP's `iss` as `expectedHolderDid`. Nothing
ties `iss` to the signing key. A VP signed by one key could name another
holder in `iss`, and the trusted-holder check would compare credential
subjects against that unproven claim. Taking the DID from `kid` makes the
check compare against the key that actually signed.

Velocity wallets already meet this rule (see
[What Velocity wallets send](#what-velocity-wallets-send)).

**2. Check the submission.** `validatePresentation(vp, exchange, context)`.
This checks the submission schema, the VP `@context` and the descriptor
paths. It also checks that `definition_id` is `<exchangeId>.<serviceId>`.
The holder signed the `definition_id`, so a captured VP can't be replayed
against another exchange.

**3. Pick the credentials.** Let `requestedTypes` be the
`disclosureRequest.types` types.

- `vp.verifiableCredential` must be an array of strings of at most 100
  entries. Otherwise return 400 `presentation_invalid`.
  `verifyCredentials` would throw a `TypeError` (a 500) above 100.
- Decode each entry with `decodeCredentialEnvelope` and keep it when
  `extractCredentialType(credential)` is in `requestedTypes`. Skip entries
  that can't be decoded.
- If nothing is left, return 401 `integrated_identification_user_not_found`.

Only these credentials are checked and matched. A credential of another type
that happens to have `credentialSubject.email` (an employment credential, say)
doesn't prove the holder controls that email. Leaving the extra credentials
unchecked also keeps vouchers free (see
[Verification vouchers](#5-verification-vouchers)). The type is read before
verification, and verification recomputes it from the verified credential,
so a tampered type fails the tamper check.

If a VP service uses `presentationDefinition` without `disclosureRequest`,
`requestedTypes` is empty and every VP fails. `validateIssuerService` makes an
internal VP service require `disclosureRequest.types`. It returns 400
`service_disclosureRequest_required`
(`IssuerServicesErrors.SERVICE_DISCLOSURE_REQUEST_REQUIRED`) otherwise, on
`create` and `update`.

**4. Check the credentials.** This uses a new helper,
`entities/presentations/orchestrators/check-credentials.js`, that
`verifyPresentation` also uses:

```js
const checkCredentials = (jwtVcs, expectedHolderDid, context) => {
  const { tenant } = context;
  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = tenant.caoDid;
  return verifyCredentials(
    {
      credentials: jwtVcs,
      expectedHolderDid,
      relyingParty: {
        dltOperatorKMSKeyId: tenant.keysByPurpose[KeyPurposes.DLT_TRANSACTIONS]._id,
      },
    },
    { resolveDid, getOrganizationVerifiedProfile, getCredentialTypeMetadata },
    context,
  );
};
```

`verifyPresentation` is refactored to call it, with no change in behaviour.

The handler then looks at each result in this order:

1. **Vouchers run out.** If any check is `VOUCHER_RESERVE_EXHAUSTED`, return
   402 `verification_payment_required`, as `verifyPresentation` does.
2. **A dependency fails.** If `UNTAMPERED`, `TRUSTED_ISSUER` or `UNREVOKED`
   is `DEPENDENCY_RESOLUTION_ERROR`, the ledger, registrar or revocation
   registry couldn't be reached. `UNREVOKED` gets it when the revocation
   registry can't be initialized. Return 502 `credential_check_unavailable`.
   The hook records `UNEXPECTED_ERROR` rather than `AUTHENTICATION_FAILURE`,
   and the wallet can retry. Otherwise an outage would tell the holder that
   their credential was tampered with or revoked.
3. **Any other failure.** `buildFailedCheckResultError(result, context)` from
   `@verii/verii-verification`. It returns the first failure as a 401 with a
   specific code.
4. **No holder binding.** `buildFailedCheckResultError` accepts
   `NOT_APPLICABLE` for `TRUSTED_HOLDER`. The Hub doesn't, so the handler
   also requires `TRUSTED_HOLDER === PASS`, and returns 401
   `presentation_credential_bad_holder` otherwise.

| Check | Accepted | Code on failure |
| --- | --- | --- |
| `UNTAMPERED` | `PASS` | `presentation_credential_failed_tampered` |
| `TRUSTED_ISSUER` | `PASS` (`SELF_SIGNED` fails) | `presentation_credential_bad_issuer` |
| `UNREVOKED` | `PASS` | `presentation_credential_revoked` |
| `UNEXPIRED` | `PASS`, `NOT_APPLICABLE` | `presentation_credential_expired` |
| `TRUSTED_HOLDER` | `PASS` | `presentation_credential_bad_holder` |

These are the Credential Agent's error codes, and its policy for
identification credentials (`autoIdentityCheck`, on by default), except that
the Hub also requires holder binding. The issue proposes a generic
`unauthorized` instead. The specific codes describe only the holder's own
credential, so they reveal nothing about depots. They stay 401, so the
exchange still records `AUTHENTICATION_FAILURE`.

`UNEXPIRED` accepts `NOT_APPLICABLE`, so a credential with no expiry passes.
Velocity email credentials carry no expiry, and revocation must pass.

`TRUSTED_ISSUER` must be `PASS`. A self-issued `did:jwk` credential claiming
someone's email gets `SELF_SIGNED` and fails. So does a credential from an
issuer the registrar doesn't permit for that type.

`TRUSTED_HOLDER` must be `PASS`: the credential's subject must be the DID
that signed the VP. `checkHolder` returns `NOT_APPLICABLE` for VCDM 1.1
credentials below protocol version 2, which carry no holder binding, and
anyone holding a copy of such a credential could present it. The Hub rejects
them. Email credentials issued to the holder app recently are bound, and
older ones may not be (see
[What Velocity wallets send](#what-velocity-wallets-send)).

**5. Build the candidate tuples.** These go in
`entities/exchanges/domain/vp-auth-rules.js`. Each rule runs over the decoded
credentials that passed. `w3cCredential` is the `credential` field of each
`verifyCredentials` result.

```js
// For each credential, the first of rule.path that finds anything supplies
// the values. JSONPath runs with eval: false.
const ruleValues = (rule, credentials) =>
  flow(
    flatMap((credential) => firstNonEmpty(rule.path, credential)),
    flatten,
    filter(isScalar),
    map(toAuthMatchValue),
    uniq,
  )(credentials);

const ruleCandidateValues = (rule, credentials) => {
  const values = ruleValues(rule, credentials);
  if (rule.rule === 'pick') return values;
  if (rule.rule === 'equal') return values.length === 1 ? values : [];
  return [];
};

// valueIndex runs from 0 to n-1, so ordering the rules by it puts each value
// at its rule's position. The tuples are every combination across rules.
const buildCandidateTuples = (rules, credentials) =>
  flow(
    sortBy('valueIndex'),
    map((rule) => ruleCandidateValues(rule, credentials)),
    reduce(
      (tuples, values) =>
        flatMap((tuple) => map((value) => [...tuple, value], values), tuples),
      [[]],
    ),
  )(rules);
```

- **Normalize the same way.** Values go through `toAuthMatchValue`, as
  `authValues` do, and are compared whole by the database.
- **`pick`** keeps every distinct value found. A holder can present more than
  one email credential, and any one that matches works.
- **`equal`** requires exactly one distinct value. The same email in two
  credentials counts once. Two different values make the rule yield nothing.
- **Combinations.** The candidate tuples are every combination of the rules'
  values, each value at its rule's `valueIndex`. A rule that yields nothing
  leaves no candidates.
- **JSONPath runs with `eval: false`.** Rule paths are field selectors, and
  the JSON comes from the wallet. `jsonpath-plus` 11 ignores `preventEval`,
  which `getJsonAtPath` in `validate-presentation.js` still passes; its
  default there is `eval: 'safe'`.

Then:

1. The number of candidate tuples is the product of the rules' value counts.
   The handler computes it before building them. More than 100 returns 400
   `presentation_invalid`.
2. No candidate tuples returns 401 `integrated_identification_user_not_found`.
3. `depots = findDepotsByAuthMatchTuples(exchange.serviceId, tuples)`. This is
   one query, scoped to the exchange's service and, through the repo, the
   tenant. There is no rule matching in memory: a depot is found only when
   its `authMatchValues` equals a candidate tuple exactly.

**6. Bind the depot.**

- **Exactly one depot.** Return it. `authenticate()` adds
  `AUTHENTICATION_SUCCESS` with `{ depotId }`, and the controller issues the
  same access token as for `preauth` (`sub: depot:<id>`,
  `scope: exchange:<id>`).
- **None.** Return 401 `integrated_identification_user_not_found`. Log
  `{ exchangeId, serviceId, candidateCount }`.
- **More than one.** For example, two emails that match two depots, or two
  depots created concurrently with the same tuple. Return 401
  `integrated_identification_user_not_found`, without choosing one. Log
  `{ exchangeId, serviceId, depotIds }`.

Never log emails, candidate tuples or `authMatchValues`. Log depot IDs and
counts only.

**Why not `unauthorized`.** The issue proposes `unauthorized` for a holder
who matches no depot. The holder app shows `unauthorized` as "Authorization is
invalid or has expired. Contact the issuer for a new link or QR code." That's
wrong here: the link is fine, and the holder just isn't in the batch under
that email. `integrated_identification_user_not_found` is the code the agent
returns in the same case. The holder app shows it as "{{organizationName}}
could not identify you. Try sharing other identity credentials (i.e., email,
ID, phone, etc.)."

### Errors

The exchange state comes from the existing `exchangeErrorHook`. A 401 records
`AUTHENTICATION_FAILURE`. Anything else records `UNEXPECTED_ERROR`.

| Case | Status | `errorCode` | Exchange state |
| --- | --- | --- | --- |
| Service has no auth method that fits the VP | 400 | `authentication_method_unsupported` | `UNEXPECTED_ERROR` |
| Submission invalid or for another exchange | 400 | `request_validation_failed`, `presentation_invalid`, `presentation_jsonpath_empty`, `presentation_mismatch_exchange`, `presentation_mismatch_service` | `UNEXPECTED_ERROR` |
| More than 100 credentials, or more than 100 candidate tuples | 400 | `presentation_invalid` | `UNEXPECTED_ERROR` |
| `iss` missing or isn't the signer | 401 | `unauthorized` | `AUTHENTICATION_FAILURE` |
| No credential of a requested type | 401 | `integrated_identification_user_not_found` | `AUTHENTICATION_FAILURE` |
| A credential check fails | 401 | `presentation_credential_*` (table above) | `AUTHENTICATION_FAILURE` |
| Ledger, registrar or revocation registry unreachable | 502 | `credential_check_unavailable` | `UNEXPECTED_ERROR` |
| Vouchers exhausted | 402 | `verification_payment_required` | `UNEXPECTED_ERROR` |
| No candidate tuples, no depot, or several | 401 | `integrated_identification_user_not_found` | `AUTHENTICATION_FAILURE` |

New codes in the Hub:

- PR 1: `DepotErrors.AUTH_VALUES_ALREADY_USED` and
  `IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID`
  (`service_verifiablePresentationAuthRules_invalid`).
- PR 2: `ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE`,
  `ExchangeErrors.IDENTIFICATION_USER_NOT_FOUND`
  (`integrated_identification_user_not_found`, the agent's code) and
  `IssuerServicesErrors.SERVICE_DISCLOSURE_REQUEST_REQUIRED`
  (`service_disclosureRequest_required`).

### What Velocity wallets send

This was checked against WalletIOS and WalletAndroid `v2.10.1` and the holder
app's `main`, which uses VCL 2.10.1 through `vcl-react-native`.

- **Signing.** Both SDKs sign a submission with the wallet's `did:jwk`. The
  `kid` is `<did:jwk>#0` and `iss` is the same `did:jwk`
  (`SubmissionUseCaseImpl`), so they meet the `iss` rule. The holder app signs
  remotely through careerwallet's `POST /api/v0.6/jwt/sign`. That endpoint
  keeps the SDK's header and `iss`, and sets `iat`.
- **One DID per account.** The holder app uses one `did:jwk` per account,
  stored on the careerwallet account (`didKeyMetadatum[0]`, ES256). It uses the
  same DID for submissions and for finalize-offer proofs.
- **Holder binding.** The SDKs send a proof at finalize-offers whenever the
  offers response has a `challenge`. The agent sends one whenever there are
  offers, whatever the protocol version. The agent then sets
  `credentialSubject.id` to the proof's DID and `vnfProtocolVersion` to 2
  (`build-jsonld-credential.js`). So email credentials the holder app has
  claimed since it had an account DID pass `TRUSTED_HOLDER`. Older, unbound
  ones fail with `presentation_credential_bad_holder`, which the holder app
  shows as "The {{credentialType}} credential you are trying to share is not
  valid. Please try verifying it again or use another ID credential."
- **Protocol version.** The holder app sends `x-vnf-protocol-version: 1.0`.
  careerwallet's app config last set it to `1.0` in 2024. The Hub ignores the
  header here and always verifies at version 2.
- **`kid` and `jwk` together.** All three put both `kid` and `jwk` in the VP
  header. `verifyVerifiablePresentationJwt` accepts that with a deprecation
  warning, which says it stops being accepted after 2026-12-31. If that
  becomes a rejection, every Velocity wallet VP sent to the Hub will fail:
  shared links, `preauth` links and presentations.
- **Submission shape.** The VP has `@context`
  `https://www.w3.org/2018/credentials/v1`, `jti`, and a
  `presentation_submission` with the manifest's `definition_id`. Each
  `descriptor_map` entry has the credential type as `id`,
  `$.verifiableCredential[i]` as `path` and `jwt_vc` as `format`. This passes
  `validatePresentation`.
- **Errors reach the app.** Neither SDK reclassifies errors from
  `generateOffers`. Their error taxonomy covers only the link and manifest
  steps, so the Hub's `errorCode` reaches the holder app's error map
  unchanged.
- **Output descriptors.** No client reads them (see
  [The manifest's output descriptors](#the-manifests-output-descriptors)).
- **"Already claimed" view.** When a Hub link has no offers left, the holder
  app shows what it already claimed (`findLocalDepotClaim`), keyed on the
  depot ID in the link's `vendorOriginContext`. A shared link has none, so the
  app falls back to its generic "no offers" message. That's a holder-app
  follow-up. It could key on the depot in the access token's `sub` instead.

## 4. Security

- **Self-asserted emails are refused.** The issuer must be trusted and
  permitted for the credential type, and self-signed credentials fail.
- **A VP can't be replayed to another exchange.** The signed `definition_id`
  ties it to its exchange and service.
- **Someone else's credential can't be presented.** The credential's subject
  must be the DID that signed the VP, and credentials without holder binding
  are refused.
- **Matching is exact.** The database compares the whole tuple of normalized
  values for equality, in order, with no substring, prefix or pattern
  matching. A test pins this: `a@x.com` doesn't match `ma@x.com`.
- **Matching stays in its service.** Depot lookup is scoped by tenant (in the
  repo) and by the exchange's service (in the query).
- **There's no enumeration.** A holder can only test emails they hold trusted
  credentials for. Every kind of miss returns the same code: no depot, several
  depots, or nothing at the rule's path.
- **The link carries no secret.** Anyone can start an exchange from it, as
  with any public service link. What protects the depots is authentication,
  not the link.

## 5. Verification vouchers

This answers the issue's first open question.

`verifyCredentials` resolves `did:velocity` credentials with one call to
`metadataRegistry.resolveDidDocument` for all of them. That call reads entries
for free (`getFreeEntries`) when every credential's type is on the registry's
free list. Otherwise it burns a coupon (`getPaidEntriesSigned`,
`packages/metadata-registration/src/metadata-registry.js:345`). The deployed
free list includes `Email`, `EmailV1.0`, `Phone`, `PhoneV1.0` and the ID
document types (`contracts/metadata-registry/hardhat/deploy.js:14`).

So an email-only `disclosureRequest` costs nothing per claim. Step 3 matters
here: if the wallet added a non-free credential to the VP and the Hub checked
it, the whole resolution would be paid. A service that asks for a non-free
type pays one voucher per claim and can get 402. The operator docs say so.
The free list is set on-chain by the registry's admin, so it can change by
network.

## 6. Code changes

### PR 1: finding a depot by email, and the shared link

| File | Change |
| --- | --- |
| `entities/issuer-services/domain/is-internal-vp-auth.js` | New. Used by `validateDepot`, `validateIssuerService`, `createDepot`, links and `authenticate`. |
| `entities/issuer-services/domain/validate-issuer-service.js` | Rules' `valueIndex` values must be 0 to n−1. |
| `entities/issuer-services/domain/issuer-services-errors.js` | `SERVICE_VP_AUTH_RULES_INVALID`. |
| `controllers/operator/issuer-services/schemas/new-issuer-service.schema.js` | Describes `valueIndex` as the value's position in `authValues`. |
| `entities/depots/domain/auth-match-values.js` | New. `toAuthMatchValue`, `buildAuthMatchValues`. |
| `entities/depots/domain/validate-depot.js` | One present value per rule for internal VP services. |
| `entities/depots/domain/depot-errors.js` | `AUTH_VALUES_ALREADY_USED`. |
| `entities/depots/orchestrators/create-depot.js` | Store `authMatchValues` for internal VP services. Return 409 on an identical tuple. |
| `entities/depots/repo/repo.js` | Index, `defaultProjection`, new extension. |
| `entities/depots/repo/find-depots-by-auth-match-tuples.js` | New. |
| `controllers/operator/depots/depots-controller.js` | 409 `depot-conflict-error` response on `create`. |
| `controllers/operator/depots/schemas/depot-conflict-error.schema.js` | New. The `error` schema plus `depotId`. |
| `entities/links/orchestrators/refresh-links.js` | Choose the link per the table. Skip loading a missing depot. |
| `entities/links/domain/validate-issue-link.js` | Allow no depot when the service has internal VP auth. |

### PR 2: authentication

| File | Change |
| --- | --- |
| `entities/presentations/orchestrators/check-credentials.js` | New helper. `verifyPresentation` calls it. |
| `entities/exchanges/domain/vp-auth-rules.js` | New. `ruleValues`, `buildCandidateTuples`. |
| `entities/exchanges/orchestrators/authenticate.js` | Dispatch and `vpAuthHandler`. |
| `entities/exchanges/domain/exchange-errors.js` | `CREDENTIAL_CHECK_UNAVAILABLE`, `IDENTIFICATION_USER_NOT_FOUND`. |
| `entities/issuer-services/domain/issuer-services-errors.js` | `SERVICE_DISCLOSURE_REQUEST_REQUIRED`. |
| `entities/issuer-services/domain/validate-issuer-service.js` | Require `disclosureRequest.types` for internal VP services. |
| `controllers/vn-api/vn-issuing-controller.js` | Pass `jwtVp`. Remove the no-op `validateInput`. Add `PaymentRequiredResponse`. |

`exchanges` already imports from `presentations` (`post-presentation.js`), so
this adds no new dependency between entities.

## 7. Testing

### Setup

`vn-issuing-controller-authenticate.test.js` mocks
`@verii/metadata-registration` with only `ALG_TYPE`, and
`@verii/common-fetchers` with nothing. The VP tests follow
`test/operator/presentations-controller.test.js` instead:

- Mock `initMetadataRegistry().resolveDidDocument` to return the email
  credential's key and bound issuer VC.
- Mock `initRevocationRegistry().getRevokedStatus`.
- Mock the registrar routes on `@verii/http-client`: the issuer's verified
  profile (with an identity-issuer permission) and the `EmailV1.0` type
  metadata.

The email credential is a `did:velocity` credential whose subject is the
holder's `did:jwk`. The VP's `iss` and `kid` use that same DID.

### `depots-controller.test.js` (PR 1)

- `depots/create` stores `authMatchValues` normalized and in order for an
  internal VP service, with non-strings unchanged. Neither `create` nor `get`
  returns them. `preauth` and relying-party depots don't get them.
- Fewer or more `authValues` than rules returns 400 `invalid_auth_values`. So
  does an empty or blank value.
- The same tuple in the same service returns 409 `auth_values_already_used`,
  with the existing `depotId` in the body. This also checks the 409 response
  schema. The same values differing only in case or spaces also return 409.
- There's no 409 when only some values are shared, for the same values in
  other positions, for a depot with an extra value, for another service, or
  for a `preauth` or relying-party service.
- A service with both methods gets `authMatchValues`, the 409 and the
  `authValues` validation.
- `findDepotsByAuthMatchTuples` finds only depots whose `authMatchValues`
  equal a tuple exactly, in order: not the same values at other positions,
  with an extra element or as a prefix, nor in another service or tenant. It
  finds the depots of every tuple given.
- The `{ tenantId, serviceId, authMatchValues }` index exists, with no
  collation.

### `issue-links-controller.test.js` (PR 1)

- No `depotId` on a VP service returns a `vnProtocolLink` equal to the target
  link, for `velocity-network://` and `velocity-network-testnet://`. Its
  parameters are exactly `request_uri` (whose URL has only `id`) and
  `issuerDid`. There's no `preauthCode` and no `openidCredentialOffer`.
- A VP-only service given a `depotId` returns the same shared link and
  refreshes no pre-authorized code. An unknown `depotId` returns 400
  `referenced_depot_not_found`.
- A service with both methods returns a `preauth` link given a depot, and the
  shared link without one.

### `issuer-services-controller.test.js`

- PR 1: `create` and `update` of an internal VP service whose rules'
  `valueIndex` values have a gap, a duplicate, a negative index or an index
  out of range return 400
  `service_verifiablePresentationAuthRules_invalid`. Rules in any order are
  accepted.
- PR 2: `create` and `update` of an internal VP service without
  `disclosureRequest` return 400 `service_disclosureRequest_required`. Tests
  of internal VP services that check something later (the DID document's
  service, uniqueness, `presentationDefinition`, rule indexes) now include a
  `disclosureRequest`.

### `vp-auth-rules.test.js` (PR 2)

Unit tests for building candidate tuples:

- Values are normalized and distinct, and only scalars are kept.
- For each credential, the first `path` that finds anything supplies the
  values. JSONPath scripts aren't evaluated.
- `pick` keeps every value. `equal` yields its value when there's exactly
  one, and nothing otherwise.
- Each value lands at its rule's `valueIndex`, whatever the order of the
  rules.
- The tuples are every combination across rules. A rule that finds nothing
  leaves no tuples.
- The candidate count is the product of the rules' value counts.

### `vn-issuing-controller-authenticate.test.js` (PR 2)

These replace "should error if using vp auth". The first block comes from the
issue:

- A VP with a trusted `EmailV1.0` matching a depot returns 200. The exchange
  has `depotId` and `AUTHENTICATION_SUCCESS`. `credential-offers` returns
  that depot's credentials.
- The match ignores case and surrounding spaces, in both the credential and
  `authValues`.
- No matching depot returns 401 `integrated_identification_user_not_found`
  and records `AUTHENTICATION_FAILURE`.
- Two depots with the same tuple (inserted directly) return 401
  `integrated_identification_user_not_found` and bind neither.
- An untrusted issuer, an expired credential, a revoked credential and a
  credential whose subject isn't the VP's holder each return 401 with their
  `presentation_credential_*` code.
- A JSONPath that finds nothing returns 401.
- A submission for another exchange returns 400
  `presentation_mismatch_exchange`.
- `equal` with two different values returns 401. `equal` with the same value
  in two credentials authenticates.
- A `preauth` service still authenticates as today.

Added by this design:

- `pick` doesn't match a substring: a depot for `a@x.com` and a credential
  for `ma@x.com` return 401.
- A holder presenting two email credentials authenticates when one of them
  matches a depot. When they match two different depots, it returns 401 and
  binds neither.
- More than 100 candidate tuples returns 400 `presentation_invalid`.
- A depot with the same email in another service of the same tenant, or in
  another tenant, isn't matched.
- A VP whose `iss` isn't the DID in its `kid` returns 401. So does a VP
  with no `iss`, including one whose `vp` claim carries an `issuer`.
- An unbound email credential (VCDM 1.1, no `vnfProtocolVersion`) returns
  401 `presentation_credential_bad_holder`.
- A self-signed `did:jwk` email credential returns 401
  `presentation_credential_bad_issuer`.
- An email credential with no expiry authenticates.
- A VP with an extra non-requested credential still authenticates.
  `resolveDidDocument` receives only the email credential.
- The email credential is found when it isn't the first credential in the VP.
- When the first `path` finds nothing, the rule uses the second.
- `resolveDidDocument` throwing "No available tokens" returns 402.
  `resolveDidDocument` throwing anything else returns 502
  `credential_check_unavailable` and records `UNEXPECTED_ERROR`. So does an
  unreachable registrar or revocation registry.
- A service with both methods: a VP with `vendorOriginContext` uses
  `preauth`, and one without uses VP auth.
- A VP service without `authMode: 'internal'` returns 400
  `authentication_method_unsupported`.

### `vn-issuing-controller-credential-offers.test.js` (PR 2)

- After authenticating through the shared link, `credential-offers` returns
  every claimable credential in the depot, whatever its type.

### `presentations-controller.test.js` (PR 2)

- The existing tests pass unchanged after `verifyPresentation` moves to
  `checkCredentials`.

## 8. Plan

- **Spike.** Replaced by the review of the wallet code in
  [What Velocity wallets send](#what-velocity-wallets-send). What still needs
  a device moves to the end-to-end test.
- **PR 1: finding a depot by email, and the shared link.** About 1 to 1.5
  days.
- **PR 2: the authentication handler.** About 2.5 to 3 days. That's half a
  day more than the issue's estimate, for the `kid` binding, the 402 and 502
  handling and the extra tests.
- **Afterwards.** Test end to end with the holder app on a test Hub. Check
  that the VP the Hub receives passes the `iss` rule and
  `validatePresentation`. Check an email credential claimed recently and one
  claimed before the account had a `did:jwk`, and estimate how many accounts
  would need to re-verify their email. Document
  `verifiable_presentation` issuer services for operators: setup, one
  `authValues` entry per rule, the 409 rule, deduping batches, re-creating
  depots after a rule change, vouchers for non-free types, and withdrawing a
  link.
  About 1 day.

## Decisions beyond the issue

1. Normalizing trims as well as lower-cases.
2. Failed credential checks return the agent's `presentation_credential_*`
   codes, not `unauthorized`. They're still 401.
3. The expected holder is the DID in the VP's `kid`. The VP must have an
   `iss`, read from the JWT payload, and it must equal that DID.
4. `TRUSTED_HOLDER` must be `PASS`. Unbound credentials are refused, which is
   stricter than the agent.
5. Only credentials of the `disclosureRequest` types are checked and matched.
6. For each credential, a rule's `path` takes the first JSONPath that finds
   anything.
7. A ledger, registrar or revocation registry outage returns 502, and running
   out of vouchers returns 402. Neither records `AUTHENTICATION_FAILURE`.
8. A VP-only service returns the shared link even when given a `depotId`. A
   service with both methods supports both kinds of link, because each Hub
   issuer service needs its own service entry in the issuer's DID document.
9. Internal VP services must have `disclosureRequest.types`.
10. Output descriptors stay empty on a shared link, as on the agent's batch
    link.
11. No backfill, because no deployment has used these fields.
12. A holder who matches no depot gets the agent's
    `integrated_identification_user_not_found`, not `unauthorized`, so the
    holder app shows the right message.
13. A depot's `authValues` hold exactly one value per rule, and the rules'
    `valueIndex` values are 0 to n−1.
14. `authMatchValues` is stored only on depots of internal VP services,
    including services with both methods.
15. Depots are found by whole-tuple equality in one query. The holder's
    credentials yield candidate tuples, every combination across rules, at
    most 100. Nothing is matched in memory.
16. The 409 covers the whole tuple. Concurrent duplicates are accepted, and
    authentication fails closed on them.
17. Changing a service's rules leaves its existing depots unmatched until
    they're re-created.
18. Credentials with no expiry are accepted. Velocity email credentials carry
    no expiry, and revocation must pass.

## Risks outside this work

- **`kid` with `jwk`.** `verifyVerifiablePresentationJwt` says VPs with both
  headers stop being accepted after 2026-12-31. WalletIOS, WalletAndroid and
  the holder app's remote signer all send both. Before that path becomes a
  rejection, the SDKs must stop sending `jwk`, or the deadline must move.
  Otherwise every Velocity wallet VP sent to the Hub fails.

## The issue's open questions

- **Vouchers.** Answered in section 5. An `EmailV1.0` check is free, and a
  non-free type costs one voucher per claim.
- **409 or merging.** Keep the 409. Merging would make an exchange hold more
  than one depot, which touches the token subject (`depot:<id>`),
  `authorizeExchange`, `credential-offers` and `issue-credentials`. The 409
  body gives the caller the depot to add the new credentials to.
