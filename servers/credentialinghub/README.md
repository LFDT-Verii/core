## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Docker Image

The public image is `lfdecentralizedtrust/verii-credentialing-hub`. Stable releases publish both an
exact version tag (for example, `lfdecentralizedtrust/verii-credentialing-hub:2.1.0`) and `latest`.
Opt-in prerelease builds publish an exact prerelease version tag only; they do
not move `latest`.

The image defaults to `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, and
`LOG_SEVERITY=info`. Override these only when the deployment requires it.

The image accepts generic blockchain OAuth names as aliases for the existing
Hub configuration names:

| Generic image variable | Existing Hub variable |
| --- | --- |
| `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT` | `VNF_OAUTH_TOKENS_ENDPOINT` |
| `BLOCKCHAIN_OAUTH_CLIENT_ID` | `VNF_OAUTH_CLIENT_ID` |
| `BLOCKCHAIN_OAUTH_CLIENT_SECRET` | `VNF_OAUTH_CLIENT_SECRET` |
| `BLOCKCHAIN_OAUTH_AUDIENCE` | `BLOCKCHAIN_API_AUDIENCE` |

Supply one name from each alias pair, never both: the image rejects a
configuration that provides both names in a pair.

For a generic authenticated Besu/JSON-RPC deployment, put the configuration in
an environment file such as `hub.env`:

```dotenv
RPC_NODE_URL=https://besu.example.org
CHAIN_ID=1234
REGISTRAR_URL=https://registrar.example.org
REVOCATION_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
METADATA_REGISTRY_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000002
COUPON_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000003
PERMISSIONS_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000004
ROOT_PUBLIC_KEY=04your-root-public-key
DEEP_LINK_PROTOCOL=example-network://
LIB_URL=https://lib.example.org
CREDENTIAL_EXTENSIONS_CONTEXT_URL=https://lib.example.org/contexts/credential-extensions.jsonld
BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT=https://auth.example.org/oauth/token
BLOCKCHAIN_OAUTH_CLIENT_ID=credentialing-hub
BLOCKCHAIN_OAUTH_CLIENT_SECRET=replace-with-client-secret
BLOCKCHAIN_OAUTH_AUDIENCE=https://besu.example.org
MONGO_URI=mongodb://mongo:27017/credentialinghub
HOST_URL=https://hub.example.org
SECRET=replace-with-session-secret
KEY_ENCRYPTION_SECRET=replace-with-key-encryption-secret
OPERATOR_API_TOKEN=replace-with-operator-api-token
DEFAULT_CAO_DID=did:example:cao
```

Run the image with that file:

```bash
docker run --rm --env-file hub.env -p 3000:3000 lfdecentralizedtrust/verii-credentialing-hub:latest
```

The Hub blockchain client still requires OAuth, even when the RPC endpoint
itself has no HTTP authentication. Supporting unauthenticated RPC separately
is tracked in issue #890.

For Velocity Network environments, use exactly one shortcut argument:

```bash
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  lfdecentralizedtrust/verii-credentialing-hub:latest --velocity-devnet
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  lfdecentralizedtrust/verii-credentialing-hub:latest --velocity-testnet
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  lfdecentralizedtrust/verii-credentialing-hub:latest --velocity-mainnet
```

Each shortcut owns `RPC_NODE_URL`, `CHAIN_ID`, `REGISTRAR_URL`,
`REVOCATION_CONTRACT_ADDRESS`, `METADATA_REGISTRY_CONTRACT_ADDRESS`,
`COUPON_CONTRACT_ADDRESS`, `PERMISSIONS_CONTRACT_ADDRESS`, `ROOT_PUBLIC_KEY`,
`VNF_OAUTH_TOKENS_ENDPOINT`, `BLOCKCHAIN_API_AUDIENCE`, `DEEP_LINK_PROTOCOL`,
`LIB_URL`, and `CREDENTIAL_EXTENSIONS_CONTEXT_URL`. The associated generic
aliases `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT` and `BLOCKCHAIN_OAUTH_AUDIENCE` are
also shortcut-owned. Supplying any shortcut-owned value with a shortcut
hard-fails. OAuth client ID and secret settings, plus operational and built-in
CAO settings, remain allowed.

Image arguments are reserved for a Velocity Network shortcut. For advanced
wrappers, override the entrypoint instead:

```bash
docker run --rm --entrypoint node lfdecentralizedtrust/verii-credentialing-hub:latest src/main.js
```

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
uses the built-in provider. The notification worker doesn't use a provider.
Deployments upgrading from the earlier static-token setup must now supply
`DEFAULT_CAO_DID`; it was previously optional because tenant creation could
instead receive a `caoDid` in the request. The current Operator create endpoint
does not accept that field.

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
This validation covers every core route auto-loaded under `/operator`.
Provider-owned routes registered inside a capability plugin, such as a token
endpoint, remain responsible for their own authentication behavior.

Operator tenant access is scoped to the authenticated principal's `caoDid`.
Tenant creation always assigns that CAO DID and rejects a request containing
`tenant.caoDid` with `400 request_validation_failed`. The persisted CAO DID
remains present in tenant responses. Tenant listing, explicit tenant lookup,
and deletion include the CAO DID in their repository filters. A tenant owned
by another CAO is therefore concealed using the same `tenant_not_found`
response as an unknown tenant. Public VN and OpenID routes continue to load
tenants without an Operator principal.

The blockchain plugin must decorate
`resolveBlockchainClientCredentials(request)`. Its result contains a stable,
non-secret `cacheKey` and a lazy `loadCredentials` function returning
`{ clientId, clientSecret }`. Public wallet requests can resolve their CAO from
the loaded tenant, while authenticated Operator requests can resolve it from
the Operator principal. A multi-CAO provider should reject requests when both
sources exist but disagree, or when neither source supplies a CAO DID.

Test mode (`NODE_ENV=test` or the `isTest` config value) does not change how
blockchain calls are authenticated. A custom provider's blockchain client
credentials are used in tests exactly as in production, so a wrapper's tests
can call `createAppServer` without overriding `isTest` and fake the VNF OAuth
token endpoint and the RPC node. Some test servers, such as
`createTestServer` from `@verii/server-provider`, register a stub VNF
authenticator. The built-in provider keeps that stub, while a custom
provider's credentials replace it.

Custom providers are trusted server setup code, so apart from the Operator
principal's required `caoDid`, the Hub does not perform additional shape
validation on their descriptors or principals. Fastify reports invalid plugin
and missing decorator integrations through its normal startup and request
behavior. Credential values are validated by the blockchain authentication
layer when they are consumed. Provider errors are returned to the caller and
never fall back to the built-in static credentials.

## Notification Worker

The notification worker needs only the Hub's config and MongoDB, so it starts
without a CAO security provider or its environment variables. By default it
posts every event to `NOTIFICATIONS_WEBHOOK_URL`. A wrapper can choose each
event's destination by starting the worker from its own module:

```js
// notification-worker.js
const { startNotificationWorker } = require('@verii/server-credentialing-hub');

startNotificationWorker({
  // event is the stored notification event; db is the Hub's MongoDB database.
  resolveDestination: async (event, { db }) => {
    const webhook = await db
      .collection('webhooks')
      .findOne({ tenantId: event.payload.tenantId });
    return webhook && { url: webhook.url, secret: webhook.secret };
  },
});
```

The resolver returns `{ url, secret, signatureHeaderName? }` or `null`. The URL
must pass the same checks as `NOTIFICATIONS_WEBHOOK_URL`, and the secret must
be a non-empty string. Without `signatureHeaderName`, the signature header is
`Verii-Signature`, not `NOTIFICATIONS_WEBHOOK_SIGNATURE_HEADER_NAME`. An event
with no destination, an invalid URL or an invalid secret is marked `dead`
without a request; a resolver that throws is retried like a failed delivery.
The resolver runs inside the event's 30 s claim lease and has no timeout of its
own, so it should return quickly.

`NOTIFICATIONS_WEBHOOK_URL` and `NOTIFICATIONS_WEBHOOK_SECRET` are still
required when notifications are enabled, even if the resolver doesn't use them.

Run the module directly in `standalone` mode. In `embedded-child` mode, pass
its absolute path to `startAppServer`, which forks it instead of the Hub's
worker and fails at startup if the file doesn't exist:

```js
startAppServer({
  caoSecurityProvider,
  notificationWorkerModulePath: require.resolve('./notification-worker'),
});
```

## Anchoring Worker

When a wallet sends `credential_accepted` to the OpenID4VCI notification
endpoint, the Hub queues the credential's metadata for anchoring and returns
204. The anchoring worker then anchors it on-chain, and only then sets the
credential's `acceptedAt` and adds `COMPLETE` to its exchange. A repeated
notification for the same `notification_id` doesn't queue a second job and
still returns 204, as OpenID4VCI section 11 requires.

The worker runs in each app server's process, because anchoring needs the
server's KMS, RPC provider and blockchain authentication. App servers share the
queue, the `anchoring_jobs` collection: the worker that claims a job locks it.
A custom CAO security provider's `resolveBlockchainClientCredentials` receives
the job's context instead of a request. The context has `tenant`, `config` and
`log`, but no `operatorPrincipal`.

A failed anchor is retried, waiting 10 s after the first failure and doubling
up to 15 min. The job is marked `dead`, and the credential's exchange gets
`UNEXPECTED_ERROR`, after `ANCHORING_MAX_ATTEMPTS` attempts, or at once for an
error a retry can't fix: the issuer lacks permission for the credential type,
the tenant no longer exists, or the chain has already used the metadata index.

| Variable | Default | Description |
| --- | --- | --- |
| `ANCHORING_WORKER_ENABLED` | `true` | Set to `false` to run an app server without a worker. Its jobs wait for another app server's worker. |
| `ANCHORING_WORKER_POLL_INTERVAL_MS` | `1000` | How often an idle worker checks for due jobs. |
| `ANCHORING_LOCK_DURATION_MS` | `300000` | How long a claimed job stays locked. A job still anchoring after that can be claimed and anchored again, so keep it above the chain's worst-case confirmation time. |
| `ANCHORING_MAX_ATTEMPTS` | `10` | Attempts before a job is marked `dead`. |
