# `@verii/base-contract-io`

## VNF client credential resolution

The VNF authentication plugin decorates Fastify with
`resolveVnfClientCredentials(request)`. Applications can install this
decorator before registering `authenticateVnfClientPlugin` to select VNF
credentials for each request.

Register the custom decorator before `authenticateVnfClientPlugin`. When the
decorator is installed from another Fastify plugin, wrap that plugin with
`fastify-plugin` so the decorator is visible to the authentication plugin.
Registering it later causes the authentication plugin to install its default
decorator first, and the custom registration will fail because the decorator
already exists.

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

The plugin calls the resolver once per incoming Fastify request so that an
application can select the current credential version. Blockchain operations
may make multiple JSON-RPC calls during that request; all of them reuse the
same resolver result. A resolver rejection is likewise retained for the
remainder of that request.

The plugin invokes `loadCredentials` only when there is no live token for the
resulting audience and cache key. It must resolve to non-empty string
`clientId` and `clientSecret` values. This allows credential stores such as KMS
to remain untouched on token-cache hits.

If an application does not install a resolver, the plugin installs a default
one backed by `fastify.config.vnfClientId` and
`fastify.config.vnfClientSecret`. Both values are required when the plugin
starts in this mode. A custom resolver is preserved as-is: if it rejects, the
authentication rejects and the plugin does not fall back to the configured
credentials.

The published low-level `initAuthenticateVnfClient` function also continues to
accept its original `{ audience, clientId, clientSecret }` input. New
applications should prefer the resolver contract.
