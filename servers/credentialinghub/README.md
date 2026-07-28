## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Design Docs

- [Notification webhooks design](docs/notification-webhooks-design.md)

## Operator Authentication Extension

The open-source Hub uses a static `OPERATOR_API_TOKEN` bearer token by
default. A wrapper can replace that behavior by supplying an Operator
authentication extension to `createAppServer` or `startAppServer`:

```js
const fp = require('fastify-plugin');
const {
  startAppServer,
} = require('@verii/server-credentialing-hub');

const operatorAuthPlugin = fp(async (fastify) => {
  fastify.decorate('authenticateOperator', async (request) => {
    const claims = await verifyOperatorAccessToken(request);
    request.operatorPrincipal = {
      caoDid: claims.caoDid,
      subject: claims.subject,
      subjectType: 'client',
      authenticationMethod: 'oauth2_client_credentials',
    };
  });

  // Optional. Omit this decorator to use VNF_OAUTH_CLIENT_ID and
  // VNF_OAUTH_CLIENT_SECRET.
  fastify.decorate('resolveVnfClientCredentials', async (request) => ({
    cacheKey: `${request.operatorPrincipal.caoDid}:1`,
    loadCredentials: async () =>
      loadVnfCredentials(request.operatorPrincipal.caoDid),
  }));

  // Keep private endpoints encapsulated beneath the capability plugin.
  fastify.register(privateOperatorRoutes);
});

startAppServer({
  operatorAuthExtension: {
    plugin: operatorAuthPlugin,
    tenantIsolation: 'cao',
    documentation: {
      operatorSecurityScheme: {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl: '/operator/oauth/token',
            scopes: {},
          },
        },
      },
      securitySchemes: {
        operatorClientBasic: { type: 'http', scheme: 'basic' },
      },
      tags: [
        {
          name: 'Operator Authentication',
          description: 'Machine-to-machine authentication.',
        },
      ],
    },
  },
});
```

`tenantIsolation` must be either `legacy` or `cao`. CAO isolation requires a
non-empty principal `caoDid`; every principal also requires `subject`,
`subjectType`, and `authenticationMethod`. The Hub exposes only those four
normalized fields on `request.operatorPrincipal`.

The optional VNF resolver is selected by decoration, not configuration. Once
a custom resolver is installed, its errors are returned to the caller and
never fall back to the static VNF client ID and secret.

## Data Migrations

Credentialing Hub database migrations remain in the monorepo Docker/wrapper package under `servers/credentialinghub/migrations`.

Run migrations from the monorepo image:

```sh
docker run --name credentialinghub-migrations -e MONGO_URI=**** ghcr.io/velocitynetworkfoundation/credentialinghub:latest sh -c "cd servers/credentialinghub && pnpm migrate:up"
```
