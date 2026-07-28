# `@verii/base-contract-io`

## VNF client credential resolution

The VNF authentication plugin decorates Fastify with
`resolveVnfClientCredentials(request)`. Applications can install this
decorator before registering `authenticateVnfClientPlugin` to select VNF
credentials for each request.

A resolver returns credential metadata and a lazy credential loader:

```js
fastify.decorate('resolveVnfClientCredentials', async (request) => ({
  cacheKey: `tenant:${request.tenantId}:version:2`,
  loadCredentials: async () => ({
    clientId: await readClientId(request.tenantId),
    clientSecret: await readClientSecret(request.tenantId),
  }),
}));
```

`cacheKey` must be a non-empty, stable, non-secret string that changes whenever
the selected credential pair changes. Do not include a client secret, a digest
of a client secret, or any value derived from a client secret. Tokens are
cached by both their audience and this resolver cache key.

The plugin calls the resolver on every authentication so that an application
can select the current credential version. It invokes `loadCredentials` only
when there is no live token for the resulting audience and cache key. This
allows credential stores such as KMS to remain untouched on token-cache hits.

If an application does not install a resolver, the plugin installs a default
one backed by `fastify.config.vnfClientId` and
`fastify.config.vnfClientSecret`. Both values are required when the plugin
starts in this mode. A custom resolver is preserved as-is: if it rejects, the
authentication rejects and the plugin does not fall back to the configured
credentials.
