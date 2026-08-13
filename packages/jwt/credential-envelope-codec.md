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
documents, mixed `vc`/`vp` compatibility claims, `alg: none`, unsupported first
contexts, malformed compact JWS input, and inputs that exceed its documented
limits. A legacy `vc` compatibility claim may omit `@context` to preserve
historical bound issuer credentials; when present, its first context must be the
VC 1.1 context. When `vc` is present, additional top-level JWT claims, including
`@context`, do not participate in envelope routing. A nested VC 2.0 context or a
VC 2.0 `typ` remains contradictory and is rejected. Existing
`decodeCredentialJwt` and `verifyCredentialJwt` exports remain available for
legacy callers.

`verifyCredentialEnvelope` applies the trust boundary after classification. It
allows `ES256K`, `ES256`, and `RS256`, requires the resolved JWK type and curve
to match the protected `alg`, verifies the compact signature, and only then
returns the normalized credential. The VC 2.0 profile additionally requires
the exact `typ: vc+jwt` and `cty: vc` headers, a bounded `kid` anchored to the
credential identifier, valid v2 contexts and required properties, and no
legacy JWT compatibility claims in the direct payload.
