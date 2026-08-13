# Credential envelope codec

`decodeCredentialEnvelope` parses and structurally classifies compact W3C
credential envelopes as either the legacy VC 1.1 `jwt_vc_json-ld` shape or a
direct VC 2.0 `vc+jwt` shape.

JOSE `typ` values are compared as media types: comparison is case-insensitive,
and a slashless value is treated as though it had the `application/` prefix.
The decoded result retains the protected header exactly as received.

Decoding does **not** authenticate the credential. Its result may be used to
select a verification path, but it must not be used to make decisions about
issuer trust, authorization, credential status, holder binding, or schema
validity. Those decisions must use a credential returned by the verification
layer after successful signature verification.

The codec intentionally rejects direct VC 1.1 documents, nested VC 2.0
documents, mixed legacy `vc`/`vp` compatibility envelopes, `alg: none`,
unsupported first contexts, malformed compact JWS input, and inputs that exceed
its documented limits. A direct VC 2.0 document is still classified when it
contains a prohibited `vc` or `vp` member so that conformance verification can
report the normative failure. A legacy `vc` compatibility claim may omit
`@context` to preserve
historical bound issuer credentials; when present, its first context must be the
VC 1.1 context. When `vc` is present, additional top-level JWT claims, including
`@context`, do not participate in envelope routing. A nested VC 2.0 context or a
VC 2.0 `typ` remains contradictory and is rejected. Existing
`decodeCredentialJwt` and `verifyCredentialJwt` exports remain available for
legacy callers.

`verifyCredentialEnvelope` applies the trust boundary after classification. It
returns separate `proof`, `conformance`, and `policy` assessments. Each
assessment has a status and typed errors; conformance and policy assessments
can also contain warnings. A failed assessment always returns `credential:
null`. VC 1.1 preserves its historical verification behavior and reports
conformance and policy as `NOT_APPLICABLE`.

Proof verification allows `ES256K`, `ES256`, and `RS256`, requires the resolved
JWK type and curve to match the protected `alg`, and verifies the compact
signature. Key discovery owns the relationship between `kid`, its controller,
and the trusted issuer; the verifier does not bind `kid` to the credential
`id`. The self-certifying `did:jwk` issuer/controller relationship is still
checked as conformance.

For VC 2.0, a missing or non-recommended string `typ` is a warning. `cty` is
optional; a non-recommended string value is a warning and a
non-string value is a conformance error. Static W3C core and Velocity profile
requirements are validated separately. The direct `vc` and `vp` members are
prohibited by the core schema. Registered JWT claims such as `iss`, `jti`,
`sub`, `iat`, `exp`, `nbf`, and `aud` are permitted and checked according to
their claim semantics. Velocity-specific `id` and `validFrom` requirements,
expiry, not-before, and expected-audience checks are policy results. Validation
is non-mutating.
