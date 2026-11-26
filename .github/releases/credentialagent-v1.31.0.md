## Changes

### [#1292](https://github.com/LFDT-Verii/core/pull/1292) Keep exchange secrets, presentations and codes out of Credential Agent logs

The Credential Agent redacts push tokens, identity matcher values, vendor user ids, presentations, deep links, pre-authorized codes, the codes of feeds and the credential JWTs of credential checks in its request, response and error logs, and leaves exchange events out of error logs. Holder API request logs carry the user id instead of the access token's claims and the user mapping. The error for an empty presentation descriptor path no longer carries the decoded presentation. It also takes the logging changes in the platform 1.5.0 packages.

## Backward incompatibilities

- A server that embeds the Credential Agent and passes `logRedactPaths` in `configOverrides` now adds them to the agent's own list instead of replacing it.
- Exchanges logged with errors show `...shhh...` for `events`. The history stays on the stored exchange.
- The `;` and not-found changes in `@verii/server-provider` 1.5.0 apply: a `;` no longer starts the query string, and 404 response bodies show the censored url.
