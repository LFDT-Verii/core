# Credentialing Hub Swagger Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Credentialing Hub Swagger output into accurate Operator, OpenID4VC Wallet, and VN-API Wallet documents, with Credentialing Hub titles and one selector UI.

**Architecture:** Extend `@verii/server-provider` with optional named Swagger documents while retaining its existing default document and UI behavior. CIH classifies routes through encapsulated Fastify `onRoute` hooks, and each Swagger transform clones and hides schemas outside its audience; controller schemas provide visible tags, summaries, operation IDs, and operation-level security.

**Tech Stack:** Node.js CommonJS, Fastify 5, `@fastify/swagger` 9, `@fastify/swagger-ui` 5, Node test runner, `expect`, pnpm 10.

## Global Constraints

- This is documentation-only; endpoint routing, handlers, and runtime authentication must not change.
- `/documentation/json` remains the default machine-readable endpoint and contains the Operator API.
- CIH Swagger titles must say `Velocity Credentialing Hub`, never `Credential Agent`.
- `info.version` for all three documents comes from `servers/credentialinghub/package.json`.
- Routes without an explicit audience are hidden from all three CIH documents.
- Existing servers without named-document configuration retain `/documentation/json`, `/documentation/yaml`, and their current Swagger UI behavior.
- Test documentation orchestration from public HTTP endpoints.
- Run ESLint with `--fix` on every changed JavaScript file.
- Use `corepack $(node -p "require('./package.json').packageManager")` for pnpm commands.

---

### Task 1: Shared named-document support

**Files:**
- Modify: `packages/server/test/server.test.js`
- Modify: `packages/server/src/common-create-server.js`

**Interfaces:**
- Consumes: existing `config.swaggerInfo` and the default `fastify.swagger()` decorator.
- Produces: optional `config.swaggerDocuments = { primaryName, documents }`, where each named document has `{ name, url, decorator, openapi, transform }`.

- [ ] **Step 1: Write failing public-endpoint regression tests**

Create a server with a small default `swaggerInfo` and assert that `/documentation/json`, `/documentation/yaml`, and `/documentation/` still return 200. Create another server with:

```js
swaggerDocuments: {
  primaryName: 'Public API',
  documents: [
    {
      name: 'Internal API',
      url: '/documentation/internal.json',
      decorator: 'internalSwagger',
      openapi: {
        info: { title: 'Internal API', version: '1.0.0' },
      },
      transform: ({ schema, url }) => ({
        schema: { ...schema, hide: url !== '/internal' },
        url,
      }),
    },
  ],
},
```

Register `/public` and `/internal`, then assert the named endpoint calls `internalSwagger`, includes only `/internal`, and is absent from its own generated paths. Assert `/documentation/static/swagger-initializer.js` contains both selector URLs and `"urls.primaryName":"Public API"`.

- [ ] **Step 2: Run the shared-server tests and verify RED**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-provider test
```

Expected: FAIL because `/documentation/internal.json` is 404 and the initializer has no `urls` selector.

- [ ] **Step 3: Implement optional named documents**

Extract registration inside `common-create-server.js` so it:

```js
server.register(fastifySwagger, {
  openapi: config.swaggerInfo,
  exposeRoute: true,
  ...config.swaggerOptions,
});

for (const document of config.swaggerDocuments?.documents ?? []) {
  server.register(fastifySwagger, {
    openapi: document.openapi,
    transform: document.transform,
    decorator: document.decorator,
  });
  server.get(document.url, { schema: { hide: true } }, () =>
    server[document.decorator](),
  );
}
```

When named documents exist, add default and named entries to `uiConfig.urls` and set `uiConfig['urls.primaryName']`; otherwise keep only `{ deepLinking: true }`. Register Swagger UI after the generators and hidden named JSON routes.

- [ ] **Step 4: Run the shared-server tests and verify GREEN**

Run the Task 1 Step 2 command. Expected: all shared-server tests pass.

---

### Task 2: CIH document configuration and audience filtering

**Files:**
- Create: `servers/credentialinghub/src/config/swagger-config.js`
- Create: `servers/credentialinghub/src/documentation/set-documentation-audience.js`
- Create: `servers/credentialinghub/src/controllers/vn-api/autohooks.js`
- Modify: `servers/credentialinghub/src/config/config.js`
- Modify: `servers/credentialinghub/src/controllers/operator/autohooks.js`
- Modify: `servers/credentialinghub/src/controllers/openid4vc/autohooks.js`
- Modify: `servers/credentialinghub/src/controllers/openid4vp/autohooks.js`
- Modify: `servers/credentialinghub/src/controllers/root-controller.js`
- Modify: `servers/credentialinghub/src/controllers/app-redirect/controller.js`
- Modify: `servers/credentialinghub/test/swagger.test.js`

**Interfaces:**
- Consumes: Task 1 `swaggerDocuments` configuration and Fastify route `config.documentationAudience`.
- Produces: `createSwaggerConfig(version)` and the audiences `operator`, `openid4vc`, `vn-api`, and `hidden`.

- [ ] **Step 1: Replace the smoke test with failing document-partition tests**

Define the exact expected method/path sets from the design and fetch:

```js
const DOCUMENTS = {
  operator: '/documentation/json',
  openid4vc: '/documentation/openid4vc.json',
  vnApi: '/documentation/vn-api.json',
};
```

Assert titles, package version, ordered tags, exact operation sets, no overlap, no `/app-redirect`, and no documentation paths. Fetch the Swagger initializer and assert it contains all three names/URLs and selects `Operator API`.

- [ ] **Step 2: Run the CIH Swagger test and verify RED**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub exec cross-env NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks --test-reporter=spec test/swagger.test.js
```

Expected: FAIL because named endpoints do not exist and the default document is still titled `Credential Agent v2`.

- [ ] **Step 3: Add CIH OpenAPI document metadata**

`createSwaggerConfig(version)` returns the operator `swaggerInfo`, an operator `swaggerOptions.transform`, and two named documents. Use these exact titles and tag orders:

```js
const OPERATOR_TITLE = 'Velocity Credentialing Hub — Operator API';
const OPENID4VC_TITLE =
  'Velocity Credentialing Hub — OpenID4VC Wallet API';
const VN_API_TITLE = 'Velocity Credentialing Hub — VN-API Wallet API';
```

Declare only the security schemes relevant to each document: `operatorBearer`, `openid4vcAccessToken`, and `vnApiAccessToken`. Build each transform with:

```js
const createAudienceTransform = (audience) => ({ schema, url, route }) => ({
  schema: {
    ...schema,
    hide: route?.config?.documentationAudience !== audience,
  },
  url,
});
```

- [ ] **Step 4: Classify encapsulated controller scopes**

`setDocumentationAudience(fastify, audience)` installs an `onRoute` hook that adds `documentationAudience` to route config without changing handlers. Call it from operator, OpenID4VC, OpenID4VP, and VN-API autohooks. Mark the root route as `operator` and `/app-redirect` as `hidden` in their route configs.

- [ ] **Step 5: Run the CIH Swagger test**

Run the Task 2 Step 2 command. Expected: document endpoints and partitions pass; metadata assertions for individual operations may remain red until Task 3.

---

### Task 3: Operation grouping, descriptions, IDs, and security

**Files:**
- Modify: `servers/credentialinghub/src/controllers/root-controller.js`
- Modify: all nine `servers/credentialinghub/src/controllers/operator/*/*-controller.js` files
- Modify: `servers/credentialinghub/src/controllers/openid4vc/oauth-controller.js`
- Modify: `servers/credentialinghub/src/controllers/openid4vc/openid4vc-metadata-controller.js`
- Modify: `servers/credentialinghub/src/controllers/openid4vc/openid4vci-controller.js`
- Modify: `servers/credentialinghub/src/controllers/openid4vp/openid4vp-controller.js`
- Modify: `servers/credentialinghub/src/controllers/vn-api/vn-issuing-controller.js`
- Modify: `servers/credentialinghub/src/controllers/vn-api/vn-api-presentation-controller.js`
- Modify: `servers/credentialinghub/test/swagger.test.js`

**Interfaces:**
- Consumes: Task 2 audience filtering and top-level tag declarations.
- Produces: one tag, one action-oriented summary, and one unique operation ID for every documented operation.

- [ ] **Step 1: Add failing assertions for operation metadata and security**

For every operation, assert one expected tag, a non-empty summary, and a globally unique `operationId`. Assert exact security:

```js
const OPERATOR_SECURITY = [{ operatorBearer: [] }];
const OPENID4VC_SECURITY = [{ openid4vcAccessToken: [] }];
const VN_API_SECURITY = [{ vnApiAccessToken: [] }];
```

All operator routes except `GET /` use operator security. Only OpenID4VC credential/notification and VN-API credential-offers/issue-credentials use bearer security; all other wallet operations have no operation-level security.

- [ ] **Step 2: Run the CIH Swagger test and verify RED**

Run the Task 2 Step 2 command. Expected: FAIL on missing tags, summaries, IDs, and renamed schemes.

- [ ] **Step 3: Apply controller-level tags and operation metadata**

Call `fastify.autoSchemaPreset({ tags: ['<Tag>'] })` once per controller and add `summary` and `operationId` to every `fastify.autoSchema(...)` object. Use verb/entity IDs such as `createTenant`, `getIssuerServices`, `createOpenid4vcCredential`, and `submitVnApiPresentation`.

Add a schema to the two previously sparse metadata routes so they receive `Metadata & OAuth` tags, summaries, and IDs. Preserve every existing body, parameter, response, error handler, and runtime auth hook.

- [ ] **Step 4: Apply exact operation-level security**

Rename the operator autohook preset to `{ security: [{ operatorBearer: [] }] }`. Add `{ security: [{ openid4vcAccessToken: [] }] }` only to OpenID4VC credential and notification schemas, and `{ security: [{ vnApiAccessToken: [] }] }` only to VN-API credential offers and issue credentials.

- [ ] **Step 5: Run the CIH Swagger test and verify GREEN**

Run the Task 2 Step 2 command. Expected: all CIH Swagger partition, metadata, selector, and security tests pass.

---

### Task 4: Formatting and verification

**Files:**
- Modify mechanically: every changed `.js` file above, if ESLint fixes formatting.

**Interfaces:**
- Consumes: Tasks 1–3 implementation.
- Produces: lint-clean, regression-tested code matching the approved design.

- [ ] **Step 1: Run ESLint with fixes on affected JavaScript files**

Run the workspace ESLint binary through the pinned package manager against the exact changed `.js` paths with `--fix`.

- [ ] **Step 2: Re-run focused suites**

Run the shared-server package suite and the CIH Swagger integration test from Tasks 1 and 2. Expected: all pass with zero failures.

- [ ] **Step 3: Run the complete CIH test suite**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub test
```

Expected: all CIH tests pass.

- [ ] **Step 4: Review generated OpenAPI and the final diff**

Assert no CIH source still contains `Credential Agent` or the old `bearerAuth` scheme, check the three operation sets programmatically, run `git diff --check`, and review `git diff --stat` plus `git status --short` before reporting completion.
