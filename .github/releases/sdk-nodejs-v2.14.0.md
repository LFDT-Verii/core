## Changes

### [#1292](https://github.com/LFDT-Verii/core/pull/1292) Log only HTTP metadata for the SDK's requests

Through `@verii/http-client` 1.5.0, the SDK's HTTP requests log only the origin, the path and url with listed query parameter values censored, the request id and the status. Request and response headers and response bodies are no longer logged.

## Backward incompatibilities

None.
