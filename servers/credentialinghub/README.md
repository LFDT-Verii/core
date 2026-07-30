## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Design Docs

- [Notification webhooks design](docs/notification-webhooks-design.md)

## CAO Security Provider

The open-source Hub has a built-in single-CAO security provider. In production,
the provider's config plugin loads and requires `OPERATOR_API_TOKEN`,
`DEFAULT_CAO_DID`, `VNF_OAUTH_CLIENT_ID`, and `VNF_OAUTH_CLIENT_SECRET`,
without replacing values supplied through `configOverrides`. It authenticates
every Operator API request with the static bearer token. The blockchain
contract calling code uses the configured client credentials directly, so the
default provider does not install a blockchain credentials capability plugin.
Startup fails when any of the four values is absent from both
`configOverrides` and the environment. This applies to every entry point that
uses the built-in provider, including the standalone notification worker.
Deployments upgrading from the earlier static-token setup must now supply
`DEFAULT_CAO_DID`; it was previously optional because tenant creation could
instead receive a `caoDid` in the request.

A wrapper that supports multiple CAOs can replace the default provider by
supplying a `caoSecurityProvider` to `createAppServer` or `startAppServer`.
The provider is a flat object with the following properties:

- `configPlugin` is an optional Fastify plugin for loading provider-specific
  runtime configuration. It is registered before the capability plugins.
- `operatorAuthPlugin` authenticates Operator API requests and sets
  `request.operatorPrincipal`.
- `blockchainClientCredentialsPlugin` resolves the
  blockchain client credentials for the CAO associated with a request.
- `documentation` optionally supplies Operator Swagger metadata. Omit it or use
  `documentation: {}` to retain the built-in Swagger metadata.

Both capability plugins are required when a custom provider is supplied. The
config plugin is optional. In this mode, the four static environment variables
are optional, and the Hub does not fall back to any static value if either
custom capability fails.

```js
const fp = require('fastify-plugin');
const { from } = require('env-var');
const { startAppServer } = require('@verii/server-credentialing-hub');

const configPlugin = fp(async (fastify) => {
  const env = from(process.env);
  fastify.config.caoSecurityIssuer =
    fastify.config.caoSecurityIssuer ??
    env.get('CAO_SECURITY_ISSUER').required().asString();
});

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
    configPlugin,
    operatorAuthPlugin,
    blockchainClientCredentialsPlugin,
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

Every supplied plugin must be wrapped with `fastify-plugin`. The optional
config plugin may add provider-specific runtime values to `fastify.config` and
should preserve explicit configuration overrides. It runs after the core
server and Swagger configuration are constructed, so it cannot configure
those concerns; Swagger metadata belongs in the top-level `documentation`
property.

The Operator plugin must decorate `authenticateOperator`; the authenticator
must either reject the request by throwing or sending a reply, or set
`request.operatorPrincipal` on success. The Hub owns the `operatorPrincipal`
request decoration, so a provider must not redecorate it. A successful
principal must have a non-empty string `caoDid`. The Hub rejects an Operator
request with `401 operator_cao_did_invalid` before controller or tenant-loading
logic runs when the returned principal does not meet that requirement. Other
principal fields are provider-owned data and are not normalized by the Hub.

Operator tenant access is scoped to the authenticated principal's `caoDid`.
Tenant creation assigns that CAO DID when the request omits it and rejects a
different supplied value with `400 cao_did_mismatch`. Tenant listing, explicit
tenant lookup, and deletion include the CAO DID in their repository filters.
A tenant owned by another CAO is therefore concealed using the same
`tenant_not_found` response as an unknown tenant. Public VN and OpenID routes
continue to load tenants without an Operator principal.

The blockchain plugin must decorate
`resolveBlockchainClientCredentials(request)`. Its result contains a stable,
non-secret `cacheKey` and a lazy `loadCredentials` function returning
`{ clientId, clientSecret }`. Public wallet requests can resolve their CAO from
the loaded tenant, while authenticated Operator requests can resolve it from
the Operator principal. A multi-CAO provider should reject requests when both
sources exist but disagree, or when neither source supplies a CAO DID.

Custom providers are trusted server setup code, so apart from the Operator
principal's required `caoDid`, the Hub does not perform additional shape
validation on their descriptors or principals. Fastify reports invalid plugin
and missing decorator integrations through its normal startup and request
behavior. Credential values are validated by the blockchain authentication
layer when they are consumed. Provider errors are returned to the caller and
never fall back to the built-in static credentials.

## Data Migrations

Credentialing Hub database migrations remain in the monorepo Docker/wrapper package under `servers/credentialinghub/migrations`.

Run migrations from the monorepo image:

```sh
docker run --name credentialinghub-migrations -e MONGO_URI=**** ghcr.io/velocitynetworkfoundation/credentialinghub:latest sh -c "cd servers/credentialinghub && pnpm migrate:up"
```
