## Changes

### [#1292](https://github.com/LFDT-Verii/core/pull/1292) Keep codes, presentations and messaging tokens out of Credentialing Hub logs

The Credentialing Hub redacts the pre-authorized codes and the links carrying them in its operator API responses (`HUB_CLIENT_REDACT_PATHS`), presentations, push tokens, and an exchange's messaging auth token and events in errors. A failed pre-authorization check logs the depot id and the code's hash instead of the code and the depot. The error for an empty presentation descriptor path no longer carries the decoded presentation. It also takes the logging changes in the platform 1.5.0 packages.

## Backward incompatibilities

- A server that embeds the Credentialing Hub and passes `logRedactPaths` in `configOverrides` now adds them to the Hub's own list instead of replacing it.
- Exchanges logged with errors show `...shhh...` for `events`. The history stays on the stored exchange.
- The `;` and not-found changes in `@verii/server-provider` 1.5.0 apply: a `;` no longer starts the query string, and 404 response bodies show the censored url.
