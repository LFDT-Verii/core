## Changes

### [#1292](https://github.com/LFDT-Verii/core/pull/1292) Keep tokens, codes, keys and presentations out of logs and Sentry events

`@verii/logger` redacts access, id and refresh tokens, authorization and pre-authorized codes, `tx_code`, `vp_token`, the `Cookie` and `Referer` headers and `encryptedPK` in every server's logs. Logged urls show `...shhh...` for the values of the query parameters in the new `SECURITY_QUERY_PARAMS`, also when a listed parameter is nested in another parameter's value. It exports `censorUrl`, `SECURITY_QUERY_PARAMS` and `HUB_CLIENT_REDACT_PATHS`, the Credentialing Hub operator API's response fields that carry a pre-authorized code. A server that calls that API with `@verii/http-client` should add `HUB_CLIENT_REDACT_PATHS` to its `logRedactPaths`.

`@verii/server-provider` censors the url in its 404 logs and responses, logs an event's id, topic and name when its handler fails, and exports `applyConfigOverrides`, which adds an embedder's `logRedactPaths` to a server's own. `@verii/http-client` logs only the origin, the censored path and url, the request id and the status at info and error, and request and response headers and bodies at debug. It leaves a url's user and password out of its logs and errors. `@verii/error-aggregation` censors the same query parameters in Sentry events and in the breadcrumbs of outgoing requests, no longer sends the `Referer` header, and passes `sendError`'s `context.tags` to Sentry. `@verii/did-doc`, `@verii/contract-permissions` and `@verii/metadata-registration` no longer put private keys or `encryptedPK` in errors or logs, and the organizations Registrar's pubsub logs an event's id instead of the event.

### [#1291](https://github.com/LFDT-Verii/core/pull/1291) Require Fastify 5 releases

`@verii/server-provider` requires Fastify 5.10 or later, and Fastify 5 releases of `@fastify/helmet`, `@fastify/sensible`, `@fastify/swagger` and `@fastify/swagger-ui`.

### [#1290](https://github.com/LFDT-Verii/core/pull/1290) Cap the blocks a rewards run reads

The `credential-issued-rewards` task reads a bounded slice of blocks per run and saves its cursor after paying for it, so a task far behind the chain head catches up over several runs instead of running out of memory. `@verii/base-contract-io` `pullEvents` takes an optional `toBlock` and always queries the last block of its range, which it could skip before.

## Backward incompatibilities

- `@verii/server-provider` requires `fastify` 5.10 or later and Fastify 5 releases of its plugin peers.
- `@verii/server-provider` sets the root not-found handler, so calling `setNotFoundHandler` on the root instance throws. A prefixed plugin can still set one. A custom `logController`'s `routeNotFound` isn't called for root 404s.
- The router no longer treats `;` as the start of the query string, even with `useSemicolonDelimiter: true`. A url that carried query parameters after `;` gets a 404.
- 404 response bodies show the censored url.
- `@verii/http-client` logs request and response headers and bodies at debug instead of info.
