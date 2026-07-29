## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Design Docs

- [Notification webhooks design](docs/notification-webhooks-design.md)

## CAO Security Provider

The open-source Hub has a built-in single-CAO security mode. In production,
this mode requires `OPERATOR_API_TOKEN`, `DEFAULT_CAO_DID`,
`VNF_OAUTH_CLIENT_ID`, and `VNF_OAUTH_CLIENT_SECRET`. It authenticates every
Operator API request with the static bearer token and uses the configured
blockchain client credentials. Startup fails when any of the four values is
missing.

A wrapper that supports multiple CAOs can replace both capabilities by
supplying a `caoSecurityProvider` to `createAppServer` or `startAppServer`.
The provider consists of two independent Fastify capability descriptors:

- `operatorAuth` requires a `plugin` that authenticates Operator API requests
  and sets `request.operatorPrincipal`, plus a `documentation` object for
  Operator Swagger metadata. Use `documentation: {}` to retain the built-in
  Swagger metadata.
- `blockchainClientCredentials` requires a `plugin` that resolves the
  blockchain client credentials for the CAO associated with a request.

Both descriptors are required when a custom provider is supplied. In this
mode, the four static environment variables are optional. The Hub does not
fall back to any static value if either custom capability fails.

```js
const fp = require('fastify-plugin');
const { startAppServer } = require('@verii/server-credentialing-hub');

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

  // Private routes may be kept encapsulated beneath this capability plugin.
  fastify.register(privateOperatorRoutes);
});

const blockchainClientCredentialsPlugin = fp(async (fastify) => {
  fastify.decorate('resolveBlockchainClientCredentials', async (request) => {
    const tenantCaoDid = request.tenant?.caoDid;
    const principalCaoDid = request.operatorPrincipal?.caoDid;

    if (
      tenantCaoDid != null &&
      principalCaoDid != null &&
      tenantCaoDid !== principalCaoDid
    ) {
      throw new Error('tenant and Operator principal CAO DIDs must match');
    }

    const caoDid = tenantCaoDid ?? principalCaoDid;
    if (caoDid == null) {
      throw new Error('request must resolve to a CAO DID');
    }

    return {
      cacheKey: caoDid,
      loadCredentials: async () => loadBlockchainClientCredentials(caoDid),
    };
  });
});

startAppServer({
  caoSecurityProvider: {
    operatorAuth: {
      plugin: operatorAuthPlugin,
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
    blockchainClientCredentials: {
      plugin: blockchainClientCredentialsPlugin,
    },
  },
});
```

Each capability plugin must be wrapped with `fastify-plugin`. The Operator
plugin must decorate `authenticateOperator`; the authenticator must either
reject the request by throwing or sending a reply, or set
`request.operatorPrincipal` on success. The Hub owns the `operatorPrincipal`
request decoration, so a provider must not redecorate it. The principal is
provider-owned data and is not normalized by the Hub. Only
`operatorAuth.documentation` contributes custom Swagger metadata; the
blockchain capability has no documentation surface.

The blockchain plugin must decorate
`resolveBlockchainClientCredentials(request)`. Its result contains a stable,
non-secret `cacheKey` and a lazy `loadCredentials` function returning
`{ clientId, clientSecret }`. Public wallet requests can resolve their CAO from
the loaded tenant, while authenticated Operator requests can resolve it from
the Operator principal. A multi-CAO provider should reject requests when both
sources exist but disagree, or when neither source supplies a CAO DID.

Provider descriptors and required decorators are checked during startup.
Credential values are validated by the blockchain authentication layer when
they are consumed. Provider errors are returned to the caller and never fall
back to the built-in static credentials.

## Data Migrations

Credentialing Hub database migrations remain in the monorepo Docker/wrapper package under `servers/credentialinghub/migrations`.

Run migrations from the monorepo image:

```sh
docker run --name credentialinghub-migrations -e MONGO_URI=**** ghcr.io/velocitynetworkfoundation/credentialinghub:latest sh -c "cd servers/credentialinghub && pnpm migrate:up"
```
