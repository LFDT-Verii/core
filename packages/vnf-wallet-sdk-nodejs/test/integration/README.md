# Error Taxonomy Backward Compatibility Baseline

This directory contains Node SDK baseline coverage for the issue 3143 error
taxonomy work. The matching Android baseline is in
[velocitycareerlabs/WalletAndroid#195](https://github.com/velocitycareerlabs/WalletAndroid/pull/195).

The Node and Android suites intentionally cover the same scenario set:

- link validation
- request fetch and transport errors
- DID resolution
- verified profile and registration checks
- service type authorization
- request validation
- JWT verification failure

## Android Differences

The Android baseline has the same taxonomy coverage, but a few assertions differ
because the SDKs use different platform networking and URL parsing behavior:

- Transport failures:
  - Node expects `statusCode` to be `null`.
  - Android expects `VCLStatusCode.NetworkError`.
- Malformed `request_uri` values:
  - Node expects the message to contain
    `Cannot build URL without prefixUrl or full url`.
  - Android expects Java URL errors such as `no protocol: not-a-url` or
    `unknown protocol: ftp`.
- Plain text 500 responses:
  - Node expects the generic message `Request failed with status code 500`.
  - Android expects the plain text response body as the message.
- Bad URL encoding:
  - Node throws `URIError`.
  - Android throws `IllegalArgumentException` with a `URLDecoder` message.
- Duplicate DID query params:
  - Both suites assert the legacy mismatch error code.
  - Android also asserts that the last DID value reached the requested endpoint.

Keep these differences explicit when updating either SDK so future taxonomy
changes can distinguish intended cross-platform behavior from platform-specific
legacy behavior.
