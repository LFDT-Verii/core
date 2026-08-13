# `@verii/jwt`

JWT and compact Verifiable Credential helpers used by Verii packages.

## Credential envelopes

`decodeCredentialEnvelope` parses and structurally classifies compact W3C
credential envelopes as either the legacy VC 1.1 `jwt_vc_json-ld` shape or a
direct VC 2.0 `vc+jwt` shape.

JOSE `typ` values are compared as media types: comparison is case-insensitive,
and a slashless value is treated as though it had the `application/` prefix.
The decoded result retains the protected header exactly as received.

Decoding does **not** authenticate the credential. Its result may select a
verification path, but it must not be used to make decisions about issuer
trust, authorization, credential status, holder binding, or schema validity.
Those decisions must use a credential returned after verification.

The codec rejects direct VC 1.1 documents, nested VC 2.0 documents, mixed
legacy `vc`/`vp` compatibility envelopes, `alg: none`, unsupported first
contexts, malformed compact JWS input, and inputs over its documented limits.
A direct VC 2.0 document containing a prohibited `vc` or `vp` member is still
classified so the verifier can report the normative conformance failure.

A legacy `vc` compatibility claim may omit `@context` to preserve historical
bound issuer credentials. When present, its first context must be the VC 1.1
context. Additional top-level JWT claims do not participate in routing when
`vc` is present. A nested VC 2.0 context or VC 2.0 `typ` remains
contradictory and is rejected. Existing `decodeCredentialJwt` and
`verifyCredentialJwt` exports remain available for legacy callers.

## Verification result

`verifyCredentialEnvelope` returns separate `proof`, `conformance`, and
`policy` assessments. Each has a status and typed errors; conformance and
policy can also contain warnings. The `credential` property is present only
when all required assessments pass. VC 1.1 retains its legacy proof behavior
and reports conformance and policy as `NOT_APPLICABLE`.

Proof verification allows `ES256K`, `ES256`, and `RS256`, checks that the
resolved JWK type and curve match the protected `alg`, and verifies the
compact signature. Legacy JWT mode also evaluates registered JWT validity
claims. Deprecated legacy hex-key normalization occurs only after bounded
envelope decoding.

Generic key discovery owns the relationship between `kid`, its controller,
and the trusted issuer; the verifier does not bind a generic `kid` to the
credential `id`. For a self-certifying `did:jwk`, the verifier derives the DID
from the actual verification JWK and requires an exact issuer/controller/key
match.

## VC 2.0 conformance

VC 2.0 structure is checked separately from the Velocity profile using a
strict, non-mutating W3C core schema. Direct `vc` and `vp` members are
prohibited. Registered JWT claims such as `iss`, `jti`, `sub`, `iat`, `exp`,
`nbf`, and `aud` are permitted and evaluated according to their claim
semantics.

The VC JOSE/COSE recommendation says `typ` SHOULD be `vc+jwt`; missing or
non-recommended string values are warnings. `cty` is optional and, when
present, SHOULD be `vc`; a non-recommended string is a warning. Present
non-string `typ` or `cty` values are conformance errors.

## Velocity VC 2.0 profile

This section is the canonical definition of the Velocity VC 2.0 profile
enforced by `@verii/jwt`. It is intentionally kept at this layer so downstream
packages consume the assessment rather than redefine the rules.

The profile is evaluated only after proof and W3C core conformance pass. It
adds these requirements and verifier policies:

- `id` is required and must be a bounded URI;
- `validFrom` is required and must be a valid bounded date-time;
- when `exp` is present, an expired signature fails policy;
- when `nbf` is present, a signature that is not active yet fails policy;
- when the verifier supplies an expected audience, `aud` must match it;
- when `aud` is present but the verifier supplies no expected audience, the
  result contains an `AUDIENCE_NOT_EVALUATED` warning.

The temporal JWT checks use the verifier's configured clock tolerance, which
defaults to 120 seconds. `nbf` also produces a conformance warning because its
use is NOT RECOMMENDED by the VC JOSE/COSE specification.

These are not Velocity profile rules: JOSE `typ`/`cty` recommendations, generic
key discovery and issuer trust, holder matching, credential status, schema
content validation, and application-specific credential-type authorization.
Higher-level packages perform those operational checks without changing the
profile assessment returned here.

The successful policy assessment is identified as:

```js
{
  status: 'PASS',
  profile: 'velocity-vc-v2',
  errors: [],
  warnings: []
}
```

Validation does not coerce values, apply defaults, remove properties, or
expose AJV wording as the public error contract.
