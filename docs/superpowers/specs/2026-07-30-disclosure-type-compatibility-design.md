# Disclosure Type Compatibility Design

## Context

The Credentialing Hub presentation endpoints serialize decoded W3C
presentations and credentials. Their response schemas currently require
`type` to be an array, although disclosed JWT payloads can validly contain
either a string or an array of strings. A scalar presentation type caused
verification to complete and persist before response serialization failed.

The shared W3C VC schema is also used by credential creation. Credential
issuance should remain strict and continue requiring an array.

## Goal

Allow presentation disclosure and verification responses to serialize a W3C
presentation or embedded W3C credential whose `type` is either a string or an
array of strings, without changing credential-creation validation.

## Non-goals

- Do not widen the shared issuance `w3cVcSchema`.
- Do not normalize disclosed scalar values into arrays.
- Do not version the API or duplicate the complete VC schema.
- Do not add broad or redundant test coverage.

## Design

Define a presentation-scoped W3C VC schema with its own `$id`. Derive it from
the shared `w3cVcSchema`, retaining all existing properties and required
fields, while overriding only `properties.type` with a string-or-string-array
schema.

Register the presentation-scoped VC schema in the presentation controller.
Use it for:

- object credentials in `w3cPresentation.verifiableCredential`;
- decoded credentials in
  `verification.credentials[].w3cCredential`.

Update the existing presentation-scoped `w3cPresentationSchema` so its own
`type` property accepts the same two representations.

The credential creation controller continues registering and referencing the
unchanged shared `w3cVcSchema`, so `credential.content.type` remains
array-only.

## Data handling

Verification and decoding continue preserving the disclosed payload. No
normalization is introduced. Response serialization accepts either
representation and returns the value in its original shape.

## Error handling

All existing verification and request-validation behavior remains unchanged.
Only response-schema compatibility is widened for presentation disclosure.

## Test coverage

Add one integration test through `POST /operator/presentations/verify` using a
valid signed presentation whose presentation `type` and embedded credential
`type` are both strings. Assert a successful response and preservation of both
scalar values.

The existing successful verification test already covers the array
representation, so no duplicate array test is needed. Credential creation is
unchanged and does not need additional coverage for this change.
