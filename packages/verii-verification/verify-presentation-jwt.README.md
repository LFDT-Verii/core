# `verifyVerifiablePresentationJwt` Rules

This note documents the behavior implemented in
[`src/verify-presentation-jwt.js`](./src/verify-presentation-jwt.js).

## Protocol Behavior

### Protocol v1

- `verifyVerifiablePresentationJwt` delegates directly to `verifyPresentationJwt`.
- Self-signed VPs that carry a header `jwk` continue to verify as they did before
  protocol v2.

### Protocol v2

Protocol v2 resolves verification keys from `header.kid` and treats header
composition explicitly.

#### Allowed header combinations

- `kid` only:
  verification succeeds by resolving the public key from `kid` and ignoring the
  absence of `jwk`.
- `kid` and `jwk`:
  verification currently uses `kid` and ignores `jwk`.

#### Rejected header combinations

- neither `kid` nor `jwk`:
  throws `400` with message `jwt_vp must include kid or jwk in the header` and
  `errorCode: 'presentation_malformed'`.
- `jwk` without `kid`:
  throws `400` with message `jwt_vp must not be self signed` and
  `errorCode: 'presentation_malformed'`.

## `kid` Resolution Rules

- `kid` must be a DID URI that `@verii/did-doc` can resolve.
- malformed `kid` values are wrapped as
  `400 kid_<resolver message>` with `errorCode: 'presentation_malformed'`.
- signature failures after key resolution are wrapped as
  `400 Malformed jwt_vp property: <verification error>` with
  `errorCode: 'presentation_malformed'`.

## Mixed `kid` + `jwk` Deprecation

When both `kid` and `jwk` are present in protocol v2:

- verification uses `kid`
- `jwk` is ignored
- a warning is emitted through `log.warn(...)` if a logger is provided

Warning text:

```text
jwt_vp contains both kid and jwk headers; using kid and ignoring jwk for backward compatibility. This will not be accepted after 2026-12-31T23:59:59Z, and this compatibility path will be removed.
```

This compatibility path exists only until December 31, 2026. The source keeps
the future rejection logic commented in place so the branch can be restored to a
hard failure after that date.
