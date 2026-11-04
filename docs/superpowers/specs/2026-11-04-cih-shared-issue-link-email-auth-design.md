# Shared Issue Link with Email Authentication Design

Issue: [#1202](https://github.com/LFDT-Verii/core/issues/1202). Code references are to `main` at `0d69c19b`.

## Summary

A `verifiable_presentation` issuer service gets one issue link that serves a
whole batch. The wallet presents an email credential to `/authenticate`. The
Hub checks the credential, finds the one depot in the service whose
`authValues` holds that email, and binds the exchange to it. After that, the
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
- Email matching ignores case and works on MongoDB, DocumentDB and Cosmos.
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
                                 5. apply rules, find one depot
                                 6. AUTHENTICATION_SUCCESS {depotId},
                                    access token --------------------->
                                 credential-offers, issue-credentials
                                 unchanged
```

## 1. Finding a depot by email (PR 1)

### `authMatchValues`

`depots/create` stores a normalized copy of `authValues` as
`authMatchValues`, in the same positions:

```js
// entities/depots/domain/auth-match-values.js
const toAuthMatchValue = (value) =>
  isString(value) ? value.trim().toLowerCase() : value;

const buildAuthMatchValues = map(toAuthMatchValue);
```

- **All depots that have `authValues`, whatever their service's auth method.**
  If the service later switches to `verifiable_presentation`, these depots can
  already match.
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
index. It has no collation, so it works on DocumentDB and Cosmos.

A multikey query matches a value at any position, so every lookup filters on
`authMatchValues` (which the index serves), and then checks the position in
memory. A query on `authMatchValues.<n>` would be exact, but it can't use the
index.

### Repo extension

```js
// entities/depots/repo/find-depots-by-auth-match-values.js
findDepotsByAuthMatchValues: (serviceId, values) =>
  parent.find({
    filter: {
      serviceId: new ObjectId(serviceId),
      authMatchValues: { $in: values },
    },
  }),
```

`multitenantExtension` adds `tenantId`. Both `depots/create` and the
authentication handler use this function.

### Validating a VP depot

`isInternalVpAuth(service)` is the condition already repeated in
`validateDepot` and `validateIssuerService`:
`authMode === 'internal' && authMethods.includes('verifiable_presentation')`.
It moves into `entities/issuer-services/domain/is-internal-vp-auth.js`, and
those two, the links and `authenticate()` all use it.

The *lookup index* is `verifiablePresentationAuthRules[0].valueIndex`: the
first rule's value is the one used to find candidate depots.

For an internal VP service, `validateDepot` also requires
`authValues[lookupIndex]` to be a non-empty string after normalizing. If it
isn't, it returns 400 `invalid_auth_values`. Without that value the depot
could never match.

### One depot per email per service

`createDepot`, for an internal VP service only:

1. Normalize the new depot's value at the lookup index.
2. `findDepotsByAuthMatchValues(serviceId, [value])`, then keep the depots
   whose `authMatchValues[lookupIndex] === value`.
3. If one exists, throw 409 `auth_values_already_used` with
   `depotId: <existing depot id>` on the error.

Depots of `preauth`-only services and relying-party services skip the check.

**Return `errorCode` and `depotId` in the 409 body.** The `depots/create`
route declares no 409 response. When Fastify finds no schema for the status
code, its fallback serializer emits only `statusCode`, `code`, `error` and
`message`, so `errorCode` and `depotId` would be lost. The route adds
`...fastify.ConflictResponse`. The shared `error` schema has
`additionalProperties: true`, so both fields reach the client.

**Concurrent creates can both get through.** Two concurrent creates of the
same email can both pass the check. A unique index can't prevent that cheaply,
because uniqueness depends on a position taken from the service's
configuration, which `issuer-services/update` can change. The race fails
closed: authentication finds two depots, returns 401 and logs both IDs.
Operators who load a batch in parallel should dedupe it first. The operator
docs say so.

**Rule changes aren't rechecked.** If `issuer-services/update` changes the
rules, existing depots aren't revalidated. Any duplicates that result show up
at authentication time as a 401 and a log line.

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
| `verifiable_presentation` only | given | Shared link. The depot is checked to exist, but it changes nothing in the link. |
| both | given | Per-depot `preauth` link |

**A VP-only service ignores the depot.** A link built for one depot would
carry that depot's `credential_types`. Whoever authenticates through it then
sees only their own credentials of those types. Returning the shared link
keeps operators who always pass `depotId` working, with no partial offers.

**A service with both methods** gets per-depot links when given a depot, and
the shared link otherwise. `authenticate()` dispatches on what the VP carries
(see below), so both kinds of link work against the same service.

Changes:

- **Don't look up a missing depot.** `refreshIssueLinks` loads the depot only
  when `depotId != null`. Today it runs `findOne({ _id: undefined })`.
- **Validate with both methods in mind.** `validateIssueLink` raises
  `issue_link_requires_depotId` only for a `preauth` service without
  `verifiable_presentation`.
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
  handler needs the JWT header's `kid`.
- Removes the `req.validateInput(...)` call. It validates nothing (see
  [What exists today](#what-exists-today)). The VP handler validates through
  `validatePresentation`, which throws. The `preauth` path keeps its current
  behaviour.
- Adds `...fastify.PaymentRequiredResponse` so a 402 keeps its `errorCode`.
  The `5xx` response is already declared.

### Dispatch

```js
const selectAuthHandler = (service, vp) => {
  if (isPreauthCodeAuth(service) && vp.vendorOriginContext != null) {
    return preauthCodeAuthHandler;
  }
  if (isInternalVpAuth(service)) {
    return vpAuthHandler;
  }
  if (isPreauthCodeAuth(service)) {
    return preauthCodeAuthHandler; // today's 401 for a missing code
  }
  throw newError(400, ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED, {
    errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
  });
};
```

Each handler returns the depot. `authenticate()` then adds
`AUTHENTICATION_SUCCESS` with `{ depotId }`, as it does today.

A service with `verifiable_presentation` but no `authMode: 'internal'` is
unsupported. Nothing outside the Hub could do the matching.

### `vpAuthHandler`

Its inputs are the exchange (already in `AUTHENTICATION_REQUEST`), the
service, `{ vp, jwtVp }` and the request context.

**1. Holder DID.** The controller calls `verifyVerifiablePresentationJwt`
with protocol version 2, which requires a `kid` naming a `did:jwk` and checks
the VP's signature with that key. The holder is the DID part of `kid`:
`holderDid = split('#', jwtDecode(jwtVp).header.kid)[0]`.

The VP must also have an `iss` (decoded as `vp.issuer.id`) equal to
`holderDid`. A VP with no `iss`, or with a different one, returns 401
`unauthorized`. This rule is deliberately strict to start with, and can be
relaxed later if a wallet needs it.

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
`service_disclosureRequest_required` otherwise.

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
2. **A dependency fails.** If `UNTAMPERED` or `TRUSTED_ISSUER` is
   `DEPENDENCY_RESOLUTION_ERROR`, the ledger or registrar couldn't be reached.
   Return 502 `credential_check_unavailable`. The hook records
   `UNEXPECTED_ERROR` rather than `AUTHENTICATION_FAILURE`, and the wallet can
   retry. Otherwise an outage would tell the holder that their credential was
   tampered with.
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

**5. Apply the rules.** These go in `entities/exchanges/domain/vp-auth-rules.js`.
Each rule runs over the decoded credentials that passed. `w3cCredential` is
the `credential` field of each `verifyCredentials` result.

```js
const ruleValues = (rule, credentials) =>
  flow(
    flatMap((credential) => firstNonEmpty(rule.path, credential)),
    flatten,
    filter(isScalar),
    map(toAuthMatchValue),
    uniq,
  )(credentials);

// rule.path lists JSONPaths "to resolve in order": the first one that finds
// something supplies the values.
const firstNonEmpty = (paths, json) =>
  find(negate(isEmpty), map((path) => JSONPath({ path, json, eval: false }), paths)) ?? [];

const ruleMatches = ({ rule, valueIndex }, values, authMatchValues) => {
  const expected = authMatchValues?.[valueIndex];
  if (expected == null) return false;
  switch (rule) {
    case 'pick':
      return includes(expected, values); // element equality, never substring
    case 'equal':
      return values.length === 1 && values[0] === expected;
    default:
      return false;
  }
};
```

- **Normalize the same way.** Values go through `toAuthMatchValue`, as
  `authValues` do, and comparison is `===`.
- **`pick`** matches if any value found equals the depot's value. A holder can
  present more than one email credential.
- **`equal`** matches if all the values found are one distinct value, and it's
  the depot's value. The same email in two credentials counts once. Two
  different emails don't match.
- **JSONPath runs with `eval: false`.** Rule paths are field selectors, and
  the JSON comes from the wallet. `jsonpath-plus` 11 ignores `preventEval`,
  which `getJsonAtPath` in `validate-presentation.js` still passes; its
  default there is `eval: 'safe'`.

Then:

1. `lookupValues = ruleValues(rules[0], credentials)`. If it's empty, return
   401 `integrated_identification_user_not_found`.
2. `candidates = findDepotsByAuthMatchValues(exchange.serviceId, lookupValues)`.
   This is scoped to the exchange's service and, through the repo, the
   tenant.
3. `matches = filter((depot) => every((rule) => ruleMatches(rule, valuesByRule[rule], depot.authMatchValues), rules), candidates)`.

**6. Bind the depot.**

- **Exactly one match.** Return it. `authenticate()` adds
  `AUTHENTICATION_SUCCESS` with `{ depotId }`, and the controller issues the
  same access token as for `preauth` (`sub: depot:<id>`,
  `scope: exchange:<id>`).
- **None.** Return 401 `integrated_identification_user_not_found`. Log
  `{ exchangeId, serviceId, lookupValueCount }`.
- **More than one.** Return 401 `integrated_identification_user_not_found`,
  without choosing one. Log `{ exchangeId, serviceId, depotIds }`.

Never log emails or `authMatchValues`. Log depot IDs and counts only.

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
| Service has neither usable method | 400 | `authentication_method_unsupported` | `UNEXPECTED_ERROR` |
| Submission invalid or for another exchange | 400 | `request_validation_failed`, `presentation_invalid`, `presentation_jsonpath_empty`, `presentation_mismatch_exchange`, `presentation_mismatch_service` | `UNEXPECTED_ERROR` |
| `iss` missing or isn't the signer | 401 | `unauthorized` | `AUTHENTICATION_FAILURE` |
| No credential of a requested type | 401 | `integrated_identification_user_not_found` | `AUTHENTICATION_FAILURE` |
| A credential check fails | 401 | `presentation_credential_*` (table above) | `AUTHENTICATION_FAILURE` |
| Ledger or registrar unreachable | 502 | `credential_check_unavailable` | `UNEXPECTED_ERROR` |
| Vouchers exhausted | 402 | `verification_payment_required` | `UNEXPECTED_ERROR` |
| Rule finds nothing, no depot, or several | 401 | `integrated_identification_user_not_found` | `AUTHENTICATION_FAILURE` |

New codes in the Hub: `ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE`,
`ExchangeErrors.IDENTIFICATION_USER_NOT_FOUND`
(`integrated_identification_user_not_found`, the agent's code),
`DepotErrors.AUTH_VALUES_ALREADY_USED` and
`IssuerServicesErrors.SERVICE_DISCLOSURE_REQUEST_REQUIRED`.

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
- **Matching is exact.** It compares normalized values for equality, with no
  substring, prefix or pattern matching. A test pins this:
  `a@x.com` doesn't match `ma@x.com`.
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
| `entities/issuer-services/domain/is-internal-vp-auth.js` | New. Used by `validateDepot`, `validateIssuerService`, links and `authenticate`. |
| `entities/depots/domain/auth-match-values.js` | New. `toAuthMatchValue`, `buildAuthMatchValues`, `lookupValueIndex(service)`. |
| `entities/depots/domain/validate-depot.js` | Require a value at the lookup index for internal VP services. |
| `entities/depots/domain/depot-errors.js` | `AUTH_VALUES_ALREADY_USED`. |
| `entities/depots/orchestrators/create-depot.js` | Store `authMatchValues`. Return 409 on reuse. |
| `entities/depots/repo/repo.js` | Index, `defaultProjection`, new extension. |
| `entities/depots/repo/find-depots-by-auth-match-values.js` | New. |
| `controllers/operator/depots/depots-controller.js` | `...fastify.ConflictResponse` on `create`. |
| `entities/links/orchestrators/refresh-links.js` | Choose the link per the table. Skip loading a missing depot. |
| `entities/links/domain/validate-issue-link.js` | Allow no depot when the service has VP auth. |

### PR 2: authentication

| File | Change |
| --- | --- |
| `entities/presentations/orchestrators/check-credentials.js` | New helper. `verifyPresentation` calls it. |
| `entities/exchanges/domain/vp-auth-rules.js` | New. `ruleValues`, `ruleMatches`. |
| `entities/exchanges/orchestrators/authenticate.js` | Dispatch and `vpAuthHandler`. |
| `entities/exchanges/domain/exchange-errors.js` | `CREDENTIAL_CHECK_UNAVAILABLE`. |
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

### `vn-issuing-controller-authenticate.test.js`

These replace "should error if using vp auth". The first block comes from the
issue:

- A VP with a trusted `EmailV1.0` matching a depot returns 200. The exchange
  has `depotId` and `AUTHENTICATION_SUCCESS`. `credential-offers` returns
  that depot's credentials.
- The match ignores case and surrounding spaces, in both the credential and
  `authValues`.
- No matching depot returns 401 `integrated_identification_user_not_found`
  and records `AUTHENTICATION_FAILURE`.
- Two matching depots (inserted directly) return 401
  `integrated_identification_user_not_found` and bind neither.
- An untrusted issuer, an expired credential, a revoked credential and a
  credential whose subject isn't the VP's holder each return 401 with their
  `presentation_credential_*` code.
- A JSONPath that finds nothing returns 401.
- A submission for another exchange returns 400
  `presentation_mismatch_exchange`.
- `equal` with two different values doesn't match. `equal` with the same
  value in two credentials does.
- A `preauth` service still authenticates as today.

Added by this design:

- `pick` doesn't match a substring: a depot for `a@x.com` and a credential
  for `ma@x.com` return 401.
- A depot with the same email in another service of the same tenant, or in
  another tenant, isn't matched.
- A VP whose `iss` isn't the DID in its `kid` returns 401. So does a VP
  with no `iss`.
- An unbound email credential (VCDM 1.1, no `vnfProtocolVersion`) returns
  401 `presentation_credential_bad_holder`.
- A self-signed `did:jwk` email credential returns 401
  `presentation_credential_bad_issuer`.
- A VP with an extra non-requested credential still authenticates.
  `resolveDidDocument` receives only the email credential.
- The email credential is found when it isn't the first credential in the VP.
- When the first `path` finds nothing, the rule uses the second.
- `resolveDidDocument` throwing "No available tokens" returns 402.
  `resolveDidDocument` throwing anything else returns 502
  `credential_check_unavailable` and records `UNEXPECTED_ERROR`.
- A service with both methods: a VP with `vendorOriginContext` uses
  `preauth`, and one without uses VP auth.
- A VP service without `authMode: 'internal'` returns 400
  `authentication_method_unsupported`.

### `depots-controller.test.js`

- `depots/create` stores `authMatchValues` normalized, in order, with
  non-strings unchanged. Neither `create` nor `get` returns them.
- A second depot with the same email in the same service returns 409
  `auth_values_already_used`, with the existing `depotId` in the body. This
  also checks the `ConflictResponse` wiring. The same email differing only in
  case or spaces also returns 409.
- There's no 409 for another service, a `preauth` service or a relying-party
  service.
- A VP-service depot without a string at the lookup index returns 400
  `invalid_auth_values`.

### `issue-links-controller.test.js`

- No `depotId` on a VP service returns a `vnProtocolLink` equal to the target
  link, for `velocity-network://` and `velocity-network-testnet://`. Its
  parameters are exactly `request_uri` (whose URL has only `id`) and
  `issuerDid`. There's no `preauthCode` and no `openidCredentialOffer`.
- A VP-only service given a `depotId` returns the same shared link.
- A service with both methods returns a `preauth` link given a depot, and the
  shared link without one.

### `vn-issuing-controller-credential-offers.test.js`

- After authenticating through the shared link, `credential-offers` returns
  every claimable credential in the depot, whatever its type.

### `presentations-controller.test.js`

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
  `verifiable_presentation` issuer services for operators: setup, the 409
  rule, deduping batches, vouchers for non-free types, and withdrawing a link.
  About 1 day.

## Decisions beyond the issue

1. Normalizing trims as well as lower-cases.
2. Failed credential checks return the agent's `presentation_credential_*`
   codes, not `unauthorized`. They're still 401.
3. The expected holder is the DID in the VP's `kid`. The VP must have an
   `iss`, and it must equal that DID.
4. `TRUSTED_HOLDER` must be `PASS`. Unbound credentials are refused, which is
   stricter than the agent.
5. Only credentials of the `disclosureRequest` types are checked and matched.
6. `path` takes the first JSONPath that finds anything.
7. A ledger or registrar outage returns 502, and running out of vouchers
   returns 402. Neither records `AUTHENTICATION_FAILURE`.
8. A VP-only service returns the shared link even when given a `depotId`. A
   service with both methods supports both kinds of link.
9. Internal VP services must have `disclosureRequest.types`.
10. Output descriptors stay empty on a shared link, as on the agent's batch
    link.
11. No backfill, because no deployment has used these fields.
12. A holder who matches no depot gets the agent's
    `integrated_identification_user_not_found`, not `unauthorized`, so the
    holder app shows the right message.

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
