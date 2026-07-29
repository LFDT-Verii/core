## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Design Docs

- [Notification webhooks design](docs/notification-webhooks-design.md)

## Operator Authentication Extension

The open-source Hub uses a static `OPERATOR_API_TOKEN` bearer token by
default. A wrapper can replace that behavior by supplying an Operator
authentication extension to `createAppServer` or `startAppServer`:

In production, the built-in Operator mode requires
`OPERATOR_API_TOKEN`, `DEFAULT_CAO_DID`, `VNF_OAUTH_CLIENT_ID`, and
`VNF_OAUTH_CLIENT_SECRET`. Startup fails when any required value is missing;
missing VNF OAuth credentials are never interpreted as unauthenticated ledger
access.

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

  // Required when replacing the built-in Operator authentication.
  fastify.decorate('resolveVnfClientOAuthCreds', async (request) => {
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
      loadOAuthCreds: async () => loadVnfOAuthCreds(caoDid),
    };
  });

  // Keep private endpoints encapsulated beneath the capability plugin.
  fastify.register(privateOperatorRoutes);
});

startAppServer({
  operatorAuthExtension: {
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
});
```

The extension plugin must be wrapped with `fastify-plugin` and must decorate
both `authenticateOperator` and `resolveVnfClientOAuthCreds`. The authenticator
must either reject the request by throwing or sending a reply, or set
`request.operatorPrincipal` on success. The Hub owns the `operatorPrincipal`
request decoration, so the extension must not redecorate it.

Every Operator principal requires non-empty `caoDid`, `subject`, `subjectType`,
and `authenticationMethod` values. The Hub exposes only those four normalized
fields on `request.operatorPrincipal`.

The custom VNF resolver is selected by decoration, not configuration. Its
errors are returned to the caller and never fall back to the static VNF client
ID and secret. Public VN/OpenID requests resolve their CAO from the loaded
tenant, while authenticated Operator requests resolve it from the Operator
principal. A resolver must reject the request when both sources exist but
disagree, or when neither source supplies a CAO DID. A custom authentication
extension that omits the resolver fails startup, even if static VNF OAuth
credentials are present.

## Data Migrations

Credentialing Hub database migrations remain in the monorepo Docker/wrapper package under `servers/credentialinghub/migrations`.

Run migrations from the monorepo image:

```sh
docker run --name credentialinghub-migrations -e MONGO_URI=**** ghcr.io/velocitynetworkfoundation/credentialinghub:latest sh -c "cd servers/credentialinghub && pnpm migrate:up"
```
