# Shared Swagger Velocity Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Fastify logo and favicon in every Swagger UI created by `@verii/server-provider` with the approved Velocity assets.

**Architecture:** Package the exact logo and favicon PNG files under the shared server's `src/assets` directory. Load them as buffers when the shared server module initializes and pass them through the supported `@fastify/swagger-ui` `logo` and `theme.favicon` options, preserving all existing Swagger document and selector behavior.

**Tech Stack:** Node.js CommonJS, Fastify 5, `@fastify/swagger-ui` 5, Node test runner, `expect`, pnpm 10.

## Global Constraints

- Apply the branding globally to every Swagger UI created by
  `@verii/server-provider`; do not add a per-service override.
- Preserve the supplied 747-by-166 transparent PNG bytes exactly.
- Preserve the official 150-by-150 Velocity Network Foundation favicon PNG
  bytes exactly.
- Do not fetch either asset at runtime.
- Do not change OpenAPI metadata, document selectors, OAuth initialization,
  favicon-independent theme settings, or runtime API behavior.
- Test the branding through public documentation endpoints.
- Run ESLint with `--fix` on every changed JavaScript file.
- Use `corepack $(node -p "require('./package.json').packageManager")` for
  pnpm commands.

---

### Task 1: Public branding endpoint expectations

**Files:**
- Modify: `packages/server/test/server.test.js`

**Interfaces:**
- Consumes: existing `/documentation/` HTML and
  `/documentation/static/swagger-initializer.js`.
- Produces: regression coverage for the exact logo and favicon bytes exposed
  by the public Swagger UI.

- [ ] **Step 1: Add the failing integration test**

Import `createHash`, define the approved checksums, and add a small hashing
helper:

```js
const { createHash } = require('node:crypto');

const VELOCITY_LOGO_SHA256 =
  '1078983907572b93f8672a1b97ee7671e809bd8b9b31ef7721564648f5f4bd9c';
const VELOCITY_FAVICON_SHA256 =
  '324b10dc04fc04c974013d718df366bda259e599b8bbbec47443a450105b211a';

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');
```

Add this test to the `Swagger documentation` suite:

```js
it('serves the approved Velocity logo and favicon', async () => {
  server = createServer({
    ...genericConfig,
    mongoConnection,
    swaggerInfo: {
      info: { title: 'Public API', version: '1.0.0' },
    },
  });

  const [html, initializer, favicon] = await Promise.all([
    server.inject({ method: 'get', url: '/documentation/' }),
    server.inject({
      method: 'get',
      url: '/documentation/static/swagger-initializer.js',
    }),
    server.inject({
      method: 'get',
      url: '/documentation/static/theme/velocity-favicon.png',
    }),
  ]);
  const [, logoBase64] =
    initializer.body.match(/data:image\/png;base64,([^']+)/) ?? [];

  expect(html.statusCode).toEqual(200);
  expect(html.body).toContain(
    './static/theme/velocity-favicon.png',
  );
  expect(initializer.statusCode).toEqual(200);
  expect(logoBase64).toBeDefined();
  expect(sha256(Buffer.from(logoBase64, 'base64'))).toEqual(
    VELOCITY_LOGO_SHA256,
  );
  expect(favicon.statusCode).toEqual(200);
  expect(favicon.headers['content-type']).toEqual('image/png');
  expect(sha256(favicon.rawPayload)).toEqual(VELOCITY_FAVICON_SHA256);
});
```

- [ ] **Step 2: Run the shared-server test and verify RED**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-provider test
```

Expected: FAIL because the initializer embeds the default SVG logo, the HTML
references the default Swagger favicons, and the Velocity favicon endpoint
returns `404`.

---

### Task 2: Package and register the Velocity assets

**Files:**
- Create: `packages/server/src/assets/velocity-logo.png`
- Create: `packages/server/src/assets/velocity-favicon.png`
- Modify: `packages/server/src/common-create-server.js`

**Interfaces:**
- Consumes: the exact user-supplied logo and official Foundation favicon.
- Produces: `@fastify/swagger-ui` `logo` and `theme.favicon` buffer options for
  every shared Swagger UI.

- [ ] **Step 1: Add the exact PNG assets**

Decode the user-supplied data URL without resizing or re-encoding and place
the resulting PNG at `packages/server/src/assets/velocity-logo.png`. Copy the
downloaded official favicon bytes to
`packages/server/src/assets/velocity-favicon.png`.

Verify:

```bash
shasum -a 256 \
  packages/server/src/assets/velocity-logo.png \
  packages/server/src/assets/velocity-favicon.png
```

Expected checksums:

```text
1078983907572b93f8672a1b97ee7671e809bd8b9b31ef7721564648f5f4bd9c
324b10dc04fc04c974013d718df366bda259e599b8bbbec47443a450105b211a
```

- [ ] **Step 2: Load and register the packaged branding**

In `packages/server/src/common-create-server.js`, load both assets relative to
`__dirname`:

```js
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const velocityLogo = readFileSync(
  resolve(__dirname, 'assets/velocity-logo.png'),
);
const velocityFavicon = readFileSync(
  resolve(__dirname, 'assets/velocity-favicon.png'),
);
```

Extend only the existing Swagger UI registration:

```js
server.register(fastifySwaggerUI, {
  uiConfig,
  initOAuth: {},
  logo: {
    type: 'image/png',
    content: velocityLogo,
  },
  theme: {
    favicon: [
      {
        filename: 'velocity-favicon.png',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/png',
        content: velocityFavicon,
      },
    ],
  },
});
```

- [ ] **Step 3: Run ESLint and verify GREEN**

Run ESLint with `--fix` on `common-create-server.js` and `server.test.js`, then
rerun the Task 1 Step 2 command. Expected: all shared-server tests pass.

---

### Task 3: Package and live verification

**Files:**
- No additional source changes expected.

**Interfaces:**
- Consumes: Task 2's shared assets and Swagger UI registration.
- Produces: evidence that the assets publish and render correctly.

- [ ] **Step 1: Inspect package contents**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-provider pack --dry-run --json
```

Expected: the JSON file list includes both
`src/assets/velocity-logo.png` and `src/assets/velocity-favicon.png`.

- [ ] **Step 2: Re-run focused verification**

Run:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-provider test
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Verify the running CIH Swagger UI**

Allow the existing Docker Compose CIH service to reload the shared server
change. Open `https://localhost:13002/documentation/`, then verify:

- the top bar displays the supplied white Velocity wordmark;
- the Fastify logo is absent;
- the page references and successfully loads
  `/documentation/static/theme/velocity-favicon.png`; and
- the document selector and API content remain usable.

- [ ] **Step 4: Review and publish**

Run `git diff --check`, review the final diff and asset checksums, commit with
signoff, push `codex/cih-swagger-cleanup`, and update pull request #840 with
the global branding and validation details.
