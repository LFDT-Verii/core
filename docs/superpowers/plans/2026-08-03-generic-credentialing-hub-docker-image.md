# Generic Credentialing Hub Docker Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one environment-agnostic `verii/credentialing-hub` image to Docker Hub that accepts individual blockchain/OAuth settings or one of three Velocity Network shortcut arguments, while reusing the same production Dockerfile in Credentialing Hub E2E tests.

**Architecture:** A pure CommonJS resolver owns shortcut validation, immutable Velocity Network presets, and generic-to-existing OAuth aliases. A Node entrypoint applies the resolved environment before loading the unchanged Hub `src/main.js`. A Hub-specific multi-stage Dockerfile packages the existing workspace server without build-time network values. The existing package release workflow computes Docker publication metadata from the selected release group and publishes multi-architecture images only for opted-in manual prereleases or Hub production promotions.

**Tech Stack:** Node.js 24, CommonJS, Node test runner, pnpm 10, Docker BuildKit/buildx, Docker Compose, GitHub Actions, `actionlint`.

## Global Constraints

- Scope is Credentialing Hub only. Do not modify `servers/credentialagent`, its workflows, Docker configuration, E2E tests, or documentation.
- Keep Hub blockchain authentication OAuth-only. Do not implement or test unauthenticated JSON-RPC behavior here; that work is tracked by [GitHub issue #890](https://github.com/LFDT-Verii/core/issues/890).
- Leave existing contract and RPC tests unchanged. The Hub E2E environment must keep its current `.localdev.env` OAuth client credentials and LocalAuth0 endpoint.
- Do not change or remove the legacy private monorepo/GHCR image workflow. Add the public Docker Hub image only to `.github/workflows/publish-packages.workflow.yml`.
- The repository name is exactly `verii/credentialing-hub`.
- Automatic `main` prerelease runs never publish Docker. A manual prerelease publishes Docker only when `credentialinghub` is selected and the new opt-in is true. Production publishes Docker whenever `credentialinghub` is selected.
- A shortcut and any shortcut-owned environment variable, including a generic alias, hard-fail. OAuth client ID/secret variables remain allowed with shortcuts.
- Never include environment values in resolver or entrypoint error messages.
- Use `corepack $(node -p "require('./package.json').packageManager")` for pnpm commands and run ESLint `--fix` on every changed JavaScript file.
- Commit completed tasks with `--signoff` and commitlint-compatible messages. Never amend.

---

## Task 1: Add the pure runtime network resolver

**Files:**

- Create: `servers/credentialinghub/docker/velocity-network-presets.js`
- Create: `servers/credentialinghub/docker/resolve-runtime-environment.js`
- Create: `servers/credentialinghub/test/docker/resolve-runtime-environment.test.js`

- [ ] **Step 1: Write failing resolver tests**

Create `servers/credentialinghub/test/docker/resolve-runtime-environment.test.js` with `node:test` and `node:assert/strict`. The test matrix must include:

- exact whole-object output for each of `--velocity-devnet`, `--velocity-testnet`, and `--velocity-mainnet`;
- preservation of unrelated operational/secret values and no mutation of the input object;
- all four generic aliases mapping to existing Hub names;
- generic OAuth client ID/secret accepted with a shortcut;
- generic plus existing name for the same OAuth setting rejected;
- a shortcut plus an owned existing name rejected;
- a shortcut plus owned generic token/audience alias rejected;
- an explicitly empty owned variable still treated as a conflict;
- multiple, unknown, malformed, and positional arguments rejected;
- error messages containing variable names but never supplied values.

Use this shape for each profile and alias assertion:

```js
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  GENERIC_OAUTH_ALIASES,
  resolveRuntimeEnvironment,
} = require('../../docker/resolve-runtime-environment');
const {
  VELOCITY_NETWORK_PRESETS,
} = require('../../docker/velocity-network-presets');

describe('resolveRuntimeEnvironment', () => {
  for (const [shortcut, preset] of Object.entries(VELOCITY_NETWORK_PRESETS)) {
    it(`applies ${shortcut} without mutating the environment`, () => {
      const env = {
        MONGO_URI: 'mongodb://mongo/hub',
        VNF_OAUTH_CLIENT_ID: 'client-id',
        VNF_OAUTH_CLIENT_SECRET: 'client-secret',
      };
      const original = { ...env };
      const result = resolveRuntimeEnvironment({ args: [shortcut], env });

      assert.deepEqual(env, original);
      assert.deepEqual(result, { ...env, ...preset });
    });
  }

  it('maps generic OAuth settings', () => {
    const env = Object.fromEntries(
      Object.keys(GENERIC_OAUTH_ALIASES).map((name) => [name, `${name}-value`]),
    );
    const result = resolveRuntimeEnvironment({ args: [], env });

    for (const [genericName, hubName] of Object.entries(
      GENERIC_OAUTH_ALIASES,
    )) {
      assert.equal(result[hubName], `${genericName}-value`);
    }
  });
});
```

Add separate `assert.throws` cases for every failure listed above. In the redaction test, use a sentinel such as `do-not-print-this-value` and a predicate that asserts `!error.message.includes(sentinel)`.

- [ ] **Step 2: Verify the red state**

```bash
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub exec \
  node --test --test-concurrency=1 test/docker/resolve-runtime-environment.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Add immutable profile data**

Create `servers/credentialinghub/docker/velocity-network-presets.js`. Export a frozen object keyed by the three exact shortcut strings. Copy these values from legacy monorepo commit `1b10884abb`:

| Variable | `--velocity-devnet` | `--velocity-testnet` | `--velocity-mainnet` |
| --- | --- | --- | --- |
| `RPC_NODE_URL` | `https://devmember.velocitycareerlabs.io` | `https://stagingmember.velocitycareerlabs.io` | `https://member.velocitycareerlabs.io` |
| `CHAIN_ID` | `1480` | `1481` | `1482` |
| `REGISTRAR_URL` | `https://devregistrar.velocitynetwork.foundation` | `https://stagingregistrar.velocitynetwork.foundation` | `https://registrar.velocitynetwork.foundation` |
| `REVOCATION_CONTRACT_ADDRESS` | `0xD890F2D60B429f9e257FC0Bc58Ef2237776DD91B` | `0x1C29461C7480d1d8570df7c0A4F314D0bE8cD5Bf` | `0x8264cCaEa3Cacf851e6DEd77999dDB6cde6977DB` |
| `METADATA_REGISTRY_CONTRACT_ADDRESS` | `0x800B4740470C85035015a7B38DedB0f4bB82c985` | `0x1550b4f24368c8Eb839073ac04673777D9dda60A` | `0xE3AA014F2c6796ca9Da615893433D933A6A2D1c9` |
| `COUPON_CONTRACT_ADDRESS` | `0xD08600fbE01fA09490d387974CC915aD7f254A91` | `0xC172E0F7aed123Cd23c2fE0b33020f9e96B0c4Be` | `0xAE1d4258c60843a03875550C1e5E71BD8248BF84` |
| `PERMISSIONS_CONTRACT_ADDRESS` | `0x823e6B949D4972230cc9637FE83EdB080e0D72dd` | `0xDC088C3D1dC820De88A1b0DCCB25bA6B6f4A74ba` | `0x94710f19BB98bd444F984BBD8624aF2b3F9471eE` |
| `ROOT_PUBLIC_KEY` | `04994b86e03d6c7d115c678762b346619b092d3da10245b0b7473357de598688711bfdd4f4fd6ed4b20296efb6f47573a132255400a9ad8a9174de023ceffafcb1` | `045d43947e4f767e87f6a6200de1d95b56be49bb1d610304dbe360715e80a4b06a2d2af14097b2766d499d99fdaf319e949b1ce450701683db8b429feef39a6759` | `0400b8ce252db73ab92e33d4cb79a21377884540d0d7981dd23fcc1d5a916db2fcda8f286e35b663ad5123bd1423b8bdae5137bc785444a8077e89580ce33dfab3` |
| `VNF_OAUTH_TOKENS_ENDPOINT` | `https://devauth.velocitynetwork.foundation/oauth/token` | `https://stagingauth.velocitynetwork.foundation/oauth/token` | `https://auth.velocitynetwork.foundation/oauth/token` |
| `BLOCKCHAIN_API_AUDIENCE` | `https://velocitynetwork.node` | `https://velocitynetwork.node` | `https://velocitynetwork.node` |
| `DEEP_LINK_PROTOCOL` | `velocity-network-devnet://` | `velocity-network-testnet://` | `velocity-network://` |
| `LIB_URL` | `https://devlib.velocitynetwork.foundation` | `https://staginglib.velocitynetwork.foundation` | `https://lib.velocitynetwork.foundation` |
| `CREDENTIAL_EXTENSIONS_CONTEXT_URL` | `https://devlib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json` | `https://staginglib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json` | `https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json` |

Store numeric chain IDs as strings because the resolver writes into `process.env`. Freeze the outer object and every profile.

- [ ] **Step 4: Implement alias mapping and conflicts**

Create `servers/credentialinghub/docker/resolve-runtime-environment.js` with this API:

```js
const {
  VELOCITY_NETWORK_PRESETS,
} = require('./velocity-network-presets');

const GENERIC_OAUTH_ALIASES = Object.freeze({
  BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT: 'VNF_OAUTH_TOKENS_ENDPOINT',
  BLOCKCHAIN_OAUTH_CLIENT_ID: 'VNF_OAUTH_CLIENT_ID',
  BLOCKCHAIN_OAUTH_CLIENT_SECRET: 'VNF_OAUTH_CLIENT_SECRET',
  BLOCKCHAIN_OAUTH_AUDIENCE: 'BLOCKCHAIN_API_AUDIENCE',
});

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);

const applyOAuthAliases = (environment) => {
  const resolved = { ...environment };

  for (const [genericName, hubName] of Object.entries(GENERIC_OAUTH_ALIASES)) {
    if (hasOwn(environment, genericName) && hasOwn(environment, hubName)) {
      throw new Error(`${genericName} and ${hubName} cannot both be supplied`);
    }
    if (hasOwn(environment, genericName)) {
      resolved[hubName] = environment[genericName];
    }
  }

  return resolved;
};

const resolveRuntimeEnvironment = ({ args = [], env = {} }) => {
  if (args.length > 1) {
    throw new Error('Only one Velocity network shortcut may be supplied');
  }

  const [shortcut] = args;
  if (shortcut != null && !hasOwn(VELOCITY_NETWORK_PRESETS, shortcut)) {
    throw new Error(
      'Unsupported Credentialing Hub image argument. Expected one of: ' +
        Object.keys(VELOCITY_NETWORK_PRESETS).join(', '),
    );
  }

  if (shortcut == null) {
    return applyOAuthAliases(env);
  }

  const preset = VELOCITY_NETWORK_PRESETS[shortcut];
  const ownedNames = new Set(Object.keys(preset));
  const conflictingNames = [
    ...Object.keys(preset),
    ...Object.entries(GENERIC_OAUTH_ALIASES)
      .filter(([, hubName]) => ownedNames.has(hubName))
      .map(([genericName]) => genericName),
  ].filter((name) => hasOwn(env, name));

  if (conflictingNames.length > 0) {
    throw new Error(
      `${shortcut} cannot be combined with: ${conflictingNames.join(', ')}`,
    );
  }

  return { ...applyOAuthAliases(env), ...preset };
};

module.exports = { GENERIC_OAUTH_ALIASES, resolveRuntimeEnvironment };
```

Use `Object.prototype.hasOwnProperty.call`, not truthiness, so empty environment variables count as supplied. Allowed client ID/secret aliases still map when a shortcut is used. Never mutate or log the input.

- [ ] **Step 5: Test, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  servers/credentialinghub/docker/velocity-network-presets.js \
  servers/credentialinghub/docker/resolve-runtime-environment.js \
  servers/credentialinghub/test/docker/resolve-runtime-environment.test.js
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub exec \
  node --test --test-concurrency=1 test/docker/resolve-runtime-environment.test.js
git add servers/credentialinghub/docker/velocity-network-presets.js \
  servers/credentialinghub/docker/resolve-runtime-environment.js \
  servers/credentialinghub/test/docker/resolve-runtime-environment.test.js
git commit --signoff -m "feat(credentialinghub): add runtime network profiles"
```

Expected: all new tests pass.

---

## Task 2: Build a production-grade Hub image and entrypoint

**Files:**

- Create: `servers/credentialinghub/docker/entrypoint.js`
- Create: `servers/credentialinghub/docker/Dockerfile`
- Create: `servers/credentialinghub/docker/smoke-test.sh`

- [ ] **Step 1: Write a failing container-boundary smoke test**

Create executable `servers/credentialinghub/docker/smoke-test.sh`. It must:

1. Build `verii/credentialing-hub:local-smoke` from the new Dockerfile with local OCI version/revision arguments.
2. Assert `docker image inspect` reports user `node` and entrypoint `[node docker/entrypoint.js]`.
3. Inspect `.Config.Env` and fail if it contains `RPC_NODE_URL`, `CHAIN_ID`, `REGISTRAR_URL`, any contract address, `ROOT_PUBLIC_KEY`, or any `VNF_OAUTH_`/`BLOCKCHAIN_OAUTH_` value.
4. Assert `docker run ... --velocity-devn` exits non-zero with `Unsupported Credentialing Hub image argument`.
5. Assert `docker run -e RPC_NODE_URL=https://example.invalid ... --velocity-devnet` exits non-zero, names `RPC_NODE_URL`, and does not print the URL value.
6. Override the entrypoint with Node and assert `/app/package.json` names `@verii/server-credentialing-hub`.

Use `mktemp -d` and a trap for captured output. Never delete an image other than the local smoke tag.

- [ ] **Step 2: Verify the red state**

```bash
chmod +x servers/credentialinghub/docker/smoke-test.sh
servers/credentialinghub/docker/smoke-test.sh
```

Expected: FAIL because the Dockerfile does not exist.

- [ ] **Step 3: Add the same-process Node entrypoint**

Create `servers/credentialinghub/docker/entrypoint.js`:

```js
const {
  resolveRuntimeEnvironment,
} = require('./resolve-runtime-environment');

try {
  Object.assign(
    process.env,
    resolveRuntimeEnvironment({
      args: process.argv.slice(2),
      env: process.env,
    }),
  );
  require('../src/main');
} catch (error) {
  console.error(`Credentialing Hub startup configuration error: ${error.message}`);
  process.exitCode = 64;
}
```

Do not use a shell wrapper or child process; signals must reach the Hub Node process.

- [ ] **Step 4: Add the multi-stage Dockerfile**

Create `servers/credentialinghub/docker/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.24@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
FROM node:24.18.0-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS builder
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && ln -sf python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.34.5 --activate \
  && mkdir -p "${PNPM_HOME}" \
  && chown -R node:node /app "${PNPM_HOME}"
USER node
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --prod
COPY --chown=node:node packages ./packages
COPY --chown=node:node servers ./servers
RUN pnpm --filter @verii/server-credentialing-hub... install --offline --prod --frozen-lockfile
RUN pnpm --filter @verii/server-credentialing-hub --prod deploy /app/deploy

FROM node:24.18.0-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
ARG IMAGE_VERSION="0.0.0-local"
ARG IMAGE_REVISION="unknown"
LABEL org.opencontainers.image.title="Verii Credentialing Hub" \
  org.opencontainers.image.description="Environment-agnostic Verii Credentialing Hub" \
  org.opencontainers.image.source="https://github.com/LFDT-Verii/core" \
  org.opencontainers.image.url="https://hub.docker.com/r/verii/credentialing-hub" \
  org.opencontainers.image.licenses="Apache-2.0" \
  org.opencontainers.image.version="${IMAGE_VERSION}" \
  org.opencontainers.image.revision="${IMAGE_REVISION}"
ENV NODE_ENV="production" HOST="0.0.0.0" PORT="3000" LOG_SEVERITY="info"
WORKDIR /app
COPY --chown=node:node --from=builder /app/deploy ./
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/entrypoint.js ./docker/entrypoint.js
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/resolve-runtime-environment.js \
  ./docker/resolve-runtime-environment.js
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/velocity-network-presets.js \
  ./docker/velocity-network-presets.js
USER node
EXPOSE 3000
ENTRYPOINT ["node", "docker/entrypoint.js"]
```

If pnpm 10.34.5 requires legacy deploy mode, add its supported `--legacy` flag only to the deploy command. Do not alter workspace linking or the lockfile. Do not add network, contract, OAuth, tenant, database, encryption, or operator build arguments/environment values.

- [ ] **Step 5: Test, lint, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  servers/credentialinghub/docker/entrypoint.js
servers/credentialinghub/docker/smoke-test.sh
git add servers/credentialinghub/docker/entrypoint.js \
  servers/credentialinghub/docker/Dockerfile \
  servers/credentialinghub/docker/smoke-test.sh
git commit --signoff -m "feat(credentialinghub): add production container image"
```

Expected: the image builds and every boundary assertion passes.

---

## Task 3: Make Hub E2E run the production image

**Files:**

- Create: `servers/credentialinghub/docker/e2e-compose-test.js`
- Modify: `servers/credentialinghub/e2e/docker-compose.yml:16-34`

- [ ] **Step 1: Write a failing Compose-boundary integration test**

Create `servers/credentialinghub/docker/e2e-compose-test.js`. Execute `docker compose --file servers/credentialinghub/e2e/docker-compose.yml config --format json`, parse the public resolved service, and assert:

- `credentialinghub.build.dockerfile` resolves to `servers/credentialinghub/docker/Dockerfile`;
- there is no build target or command override;
- there are no packages, Hub source, or anonymous `node_modules` mounts;
- the `httpscert` named volume still targets `/certs`.

Use `execFileSync` with argument arrays and normalize Compose's absolute Dockerfile and project-prefixed volume source:

```js
const output = execFileSync(
  'docker',
  ['compose', '--file', composeFile, 'config', '--format', 'json'],
  { cwd: repoRoot, encoding: 'utf8' },
);
const service = JSON.parse(output).services.credentialinghub;

assert.equal(
  path.relative(repoRoot, service.build.dockerfile),
  'servers/credentialinghub/docker/Dockerfile',
);
assert.equal(service.build.target, undefined);
assert.equal(service.command, undefined);
assert.ok(
  service.volumes.some(
    ({ source, target }) => source.endsWith('httpscert') && target === '/certs',
  ),
);
```

- [ ] **Step 2: Verify the red state**

```bash
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub exec \
  node --test docker/e2e-compose-test.js
```

Expected: FAIL because Compose uses `eng/docker/Dockerfile-NodeE2E`, the `builder` target, mounts, and nodemon.

- [ ] **Step 3: Change only the Hub service image definition**

In `servers/credentialinghub/e2e/docker-compose.yml`, replace the current image/build/volume/command block with:

```yaml
    image: verii/credentialing-hub:local
    build:
      context: ../../..
      dockerfile: servers/credentialinghub/docker/Dockerfile
      args:
        IMAGE_VERSION: 0.0.0-e2e
        IMAGE_REVISION: e2e
    restart: on-failure
    volumes:
      - httpscert:/certs
```

Retain `.localdev.env`, LocalAuth0 inclusion, OAuth values, environment overrides, healthcheck, port, dependencies, and TLS behavior unchanged.

- [ ] **Step 4: Test, lint, live-start, and commit**

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  servers/credentialinghub/docker/e2e-compose-test.js
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub exec \
  node --test docker/e2e-compose-test.js
docker compose --file servers/credentialinghub/e2e/docker-compose.yml \
  up --detach --build --wait credentialinghub
curl --fail --insecure https://localhost:13002/
docker compose --file servers/credentialinghub/e2e/docker-compose.yml \
  down --volumes --remove-orphans
git add servers/credentialinghub/docker/e2e-compose-test.js \
  servers/credentialinghub/e2e/docker-compose.yml
git commit --signoff -m "test(credentialinghub): exercise production image in e2e"
```

Use a trap so Compose cleanup runs on failure. Expected: the image becomes healthy with the unchanged dummy OAuth path.

---

## Task 4: Add deterministic Docker publication metadata

**Files:**

- Create: `tools/release/credentialinghub-docker-metadata.js`
- Create: `tools/release/credentialinghub-docker-metadata.test.js`

- [ ] **Step 1: Write failing publication-policy unit tests**

Create `tools/release/credentialinghub-docker-metadata.test.js` using `node:test`. Cover this exact matrix:

| Environment | Groups include Hub | Manual prerelease opt-in | Version | Result |
| --- | --- | --- | --- | --- |
| `prerelease` | yes | false | `2.2.0-pre.123.0` | skip |
| `prerelease` | yes | true | `2.2.0-pre.123.0` | exact prerelease tag only |
| `prerelease` | no | true | `2.2.0-pre.123.0` | skip |
| `production` | yes | either | `2.2.0` | exact tag plus `latest` |
| `production` | no | either | `2.2.0` | skip |

Also assert:

- whitespace around comma-separated groups is normalized;
- `notcredentialinghub` is not a match;
- unsupported release environments fail;
- a stable prerelease-channel version fails when publication is requested;
- a prerelease production version fails;
- malformed versions fail;
- the CLI writes `publish`, `version`, and multiline `tags` outputs to a temporary `GITHUB_OUTPUT` file.

Use the pure-function shape below:

```js
assert.deepEqual(
  buildCredentialingHubDockerMetadata({
    environment: 'production',
    groups: 'platform, credentialinghub',
    publishPrerelease: false,
    version: '2.2.0',
  }),
  {
    publish: true,
    version: '2.2.0',
    tags: [
      'verii/credentialing-hub:2.2.0',
      'verii/credentialing-hub:latest',
    ],
  },
);
```

- [ ] **Step 2: Verify the red state**

```bash
node --test tools/release/credentialinghub-docker-metadata.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement pure policy and CLI output**

Create `tools/release/credentialinghub-docker-metadata.js` with these exports:

```js
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const IMAGE_NAME = 'verii/credentialing-hub';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const buildCredentialingHubDockerMetadata = ({
  environment,
  groups,
  publishPrerelease,
  version,
}) => {
  if (!['prerelease', 'production'].includes(environment)) {
    throw new Error(`Unsupported release environment: ${environment}`);
  }
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid Credentialing Hub version: ${version}`);
  }
  if (typeof groups !== 'string') {
    throw new Error('Release groups must be supplied');
  }

  const selectedGroups = groups
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  if (!selectedGroups.includes('credentialinghub')) {
    return { publish: false, version, tags: [] };
  }

  if (environment === 'prerelease') {
    if (!publishPrerelease) {
      return { publish: false, version, tags: [] };
    }
    if (!version.includes('-')) {
      throw new Error('Prerelease image version must contain a prerelease id');
    }
    return {
      publish: true,
      version,
      tags: [`${IMAGE_NAME}:${version}`],
    };
  }

  if (version.includes('-')) {
    throw new Error('Production image version must be stable');
  }
  return {
    publish: true,
    version,
    tags: [`${IMAGE_NAME}:${version}`, `${IMAGE_NAME}:latest`],
  };
};

const writeGithubOutput = ({ outputFile, publish, version, tags }) => {
  if (typeof outputFile !== 'string' || outputFile.length === 0) {
    throw new Error('GITHUB_OUTPUT must be supplied');
  }
  const lines = [
    `publish=${publish}`,
    `version=${version}`,
    'tags<<DOCKER_TAGS',
    ...tags,
    'DOCKER_TAGS',
    '',
  ];
  fs.appendFileSync(outputFile, lines.join(String.fromCharCode(10)));
};

if (require.main === module) {
  const manifestPath = path.resolve(
    __dirname,
    '../../servers/credentialinghub/package.json',
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const metadata = buildCredentialingHubDockerMetadata({
    environment: process.env.RELEASE_ENVIRONMENT,
    groups: process.env.RELEASE_GROUPS,
    publishPrerelease: process.env.PUBLISH_PRERELEASE_IMAGE === 'true',
    version: manifest.version,
  });
  writeGithubOutput({
    outputFile: process.env.GITHUB_OUTPUT,
    ...metadata,
  });
}

module.exports = {
  buildCredentialingHubDockerMetadata,
  writeGithubOutput,
};
```

When `require.main === module`, read the checked-in version from `servers/credentialinghub/package.json` and inputs from `RELEASE_ENVIRONMENT`, `RELEASE_GROUPS`, and `PUBLISH_PRERELEASE_IMAGE`. Require a non-empty `GITHUB_OUTPUT` and write all three outputs. Do not print the environment or credentials.

Important ordering: if Hub is not selected, return skip metadata without enforcing channel/version compatibility for the unrelated selection. If Hub is selected but a prerelease is not opted in, return skip metadata without Docker publication. Enforce prerelease/stable compatibility whenever a Hub image will publish.

- [ ] **Step 4: Test, lint, and commit**

```bash
node --test tools/release/credentialinghub-docker-metadata.test.js
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  tools/release/credentialinghub-docker-metadata.js \
  tools/release/credentialinghub-docker-metadata.test.js
node --test tools/release/credentialinghub-docker-metadata.test.js
git add tools/release/credentialinghub-docker-metadata.js \
  tools/release/credentialinghub-docker-metadata.test.js
git commit --signoff -m "test(release): define credentialing hub image policy"
```

Expected: all pure policy and CLI tests pass.

---

## Task 5: Publish selected Hub images to Docker Hub

**Files:**

- Modify: `.github/workflows/publish-packages.workflow.yml:5-17`
- Modify: `.github/workflows/publish-packages.workflow.yml:25-84`
- Modify: `.github/workflows/publish-packages.workflow.yml:86-166`
- Modify: `RELEASING.md:52-78`
- Modify: `RELEASING.md:174-186`

- [ ] **Step 1: Add the manual prerelease opt-in**

Under `workflow_dispatch.inputs`, add:

```yaml
      publish_docker_image:
        type: boolean
        description: Publish the selected Credentialing Hub prerelease to Docker Hub
        default: false
```

This input applies only to manual prerelease runs. Production ignores it and follows the selected release groups.

- [ ] **Step 2: Plan prerelease publication after Nx versioning**

Immediately after `Version prerelease packages`, add:

```yaml
      - name: Plan Credentialing Hub prerelease image
        id: credentialinghub-docker
        env:
          RELEASE_ENVIRONMENT: prerelease
          RELEASE_GROUPS: ${{ env.RELEASE_GROUPS }}
          PUBLISH_PRERELEASE_IMAGE: ${{ github.event_name == 'workflow_dispatch' && inputs.publish_docker_image || false }}
        run: node tools/release/credentialinghub-docker-metadata.js
```

Keep the existing npm publish step. After it, add these guarded steps:

```yaml
      - name: Set up QEMU
        if: steps.credentialinghub-docker.outputs.publish == 'true'
        uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 # v3
      - name: Set up Docker Buildx
        if: steps.credentialinghub-docker.outputs.publish == 'true'
        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3
      - name: Log in to Docker Hub
        if: steps.credentialinghub-docker.outputs.publish == 'true'
        uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - name: Publish Credentialing Hub prerelease image
        if: steps.credentialinghub-docker.outputs.publish == 'true'
        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7
        with:
          context: .
          file: servers/credentialinghub/docker/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.credentialinghub-docker.outputs.tags }}
          build-args: |
            IMAGE_VERSION=${{ steps.credentialinghub-docker.outputs.version }}
            IMAGE_REVISION=${{ github.sha }}
```

Automatic push runs resolve `PUBLISH_PRERELEASE_IMAGE` to false, even though the default group list contains the Hub. Never emit `latest` for prereleases.

- [ ] **Step 3: Plan and publish production images**

After `Validate production release context`, add:

```yaml
      - name: Plan Credentialing Hub production image
        id: credentialinghub-docker
        env:
          RELEASE_ENVIRONMENT: production
          RELEASE_GROUPS: ${{ inputs.groups }}
          PUBLISH_PRERELEASE_IMAGE: "false"
        run: node tools/release/credentialinghub-docker-metadata.js
```

After `Publish production packages` and before `Create production tags and GitHub releases`, add the same pinned QEMU, Buildx, and login actions, guarded on the metadata output, plus:

```yaml
      - name: Publish Credentialing Hub production image
        if: steps.credentialinghub-docker.outputs.publish == 'true'
        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7
        with:
          context: .
          file: servers/credentialinghub/docker/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.credentialinghub-docker.outputs.tags }}
          build-args: |
            IMAGE_VERSION=${{ steps.credentialinghub-docker.outputs.version }}
            IMAGE_REVISION=${{ github.sha }}
```

Production tags are exactly `verii/credentialing-hub:<package version>` and `verii/credentialing-hub:latest`. Keep Docker publication after successful npm publication and before tags/releases. Do not add Docker steps to Agent workflows.

- [ ] **Step 4: Document release policy and credentials**

Update `RELEASING.md`:

- In **Prerelease Builds**, say automatic `main` runs never publish Docker images.
- Add `publish_docker_image: true` to the manual example only for an intentionally requested disposable Hub image.
- State that a prerelease Docker publish creates only its exact version tag.
- In **Promotion**, state that selecting `credentialinghub` publishes the exact stable tag and moves `latest`.
- State that `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets are required only for jobs that publish.
- State that other release groups never trigger Docker publication.

- [ ] **Step 5: Validate workflow and commit**

```bash
node --test tools/release/credentialinghub-docker-metadata.test.js
actionlint .github/workflows/publish-packages.workflow.yml
rg -n "publish_docker_image|credentialinghub-docker|DOCKERHUB_|linux/amd64,linux/arm64" \
  .github/workflows/publish-packages.workflow.yml RELEASING.md
git add .github/workflows/publish-packages.workflow.yml \
  tools/release/credentialinghub-docker-metadata.js \
  tools/release/credentialinghub-docker-metadata.test.js RELEASING.md
git commit --signoff -m "ci: publish credentialing hub image to docker hub"
```

Expected: tests and `actionlint` pass. Every build/push step is gated by the metadata output, not substring matching. If `actionlint` is unavailable, install/run its pinned project release through an approved repo mechanism; do not skip workflow validation.

---

## Task 6: Add operator-facing image documentation

**Files:**

- Modify: `servers/credentialinghub/README.md:1-7`
- Modify: `servers/credentialinghub/README.md:178-188`

- [ ] **Step 1: Replace stale migration guidance with image documentation**

Delete `## Data Migrations`; the referenced wrapper and migrations no longer exist here. Near the top, add `## Docker Image` covering:

1. Stable exact/`latest` tags and opt-in exact-only prerelease tags.
2. Baked defaults: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `LOG_SEVERITY=info`.
3. Generic aliases:

   | Generic image variable | Existing Hub variable |
   | --- | --- |
   | `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT` | `VNF_OAUTH_TOKENS_ENDPOINT` |
   | `BLOCKCHAIN_OAUTH_CLIENT_ID` | `VNF_OAUTH_CLIENT_ID` |
   | `BLOCKCHAIN_OAUTH_CLIENT_SECRET` | `VNF_OAUTH_CLIENT_SECRET` |
   | `BLOCKCHAIN_OAUTH_AUDIENCE` | `BLOCKCHAIN_API_AUDIENCE` |

4. Supplying both names in an alias pair is an error.
5. A generic authenticated Besu/JSON-RPC example using `--env-file`, with individual values for the RPC URL, chain ID, registrar, all four contract addresses, root key, deep-link/lib/context URLs, four generic OAuth settings, and required Hub operational/built-in CAO settings (`MONGO_URI`, `HOST_URL`, `SECRET`, `KEY_ENCRYPTION_SECRET`, `OPERATOR_API_TOKEN`, `DEFAULT_CAO_DID`).
6. A note that OAuth remains required by the Hub blockchain client even when the RPC endpoint itself has no HTTP auth; issue #890 is separate.
7. All three exact shortcut examples:

```bash
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  verii/credentialing-hub:latest --velocity-devnet
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  verii/credentialing-hub:latest --velocity-testnet
docker run --rm --env-file hub-secrets.env -p 3000:3000 \
  verii/credentialing-hub:latest --velocity-mainnet
```

8. The exact shortcut-owned variables: `RPC_NODE_URL`, `CHAIN_ID`, `REGISTRAR_URL`, the four contract addresses, `ROOT_PUBLIC_KEY`, `VNF_OAUTH_TOKENS_ENDPOINT`, `BLOCKCHAIN_API_AUDIENCE`, `DEEP_LINK_PROTOCOL`, `LIB_URL`, `CREDENTIAL_EXTENSIONS_CONTEXT_URL`, plus owned aliases `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT` and `BLOCKCHAIN_OAUTH_AUDIENCE`.
9. Shortcut conflicts hard-fail; OAuth client ID/secret and operational/CAO settings remain allowed.
10. Arguments are reserved for shortcut flags. Override the entrypoint for advanced wrappers:

```bash
docker run --rm --entrypoint node verii/credentialing-hub:latest src/main.js
```

- [ ] **Step 2: Cross-check docs and commit**

```bash
rg -n "BLOCKCHAIN_OAUTH_|VNF_OAUTH_|--velocity-|RPC_NODE_URL|CONTRACT_ADDRESS|ROOT_PUBLIC_KEY" \
  servers/credentialinghub/README.md \
  servers/credentialinghub/docker/resolve-runtime-environment.js \
  servers/credentialinghub/docker/velocity-network-presets.js
if rg -n -- '---velocity-' servers/credentialinghub/README.md servers/credentialinghub/docker; then
  exit 1
fi
git add servers/credentialinghub/README.md
git commit --signoff -m "docs(credentialinghub): document generic docker image"
```

Expected: every documented alias/shortcut exists in code and no Agent image is documented.

---

## Task 7: Run final regression and release-readiness verification

**Files:** Verify only; change a file only to fix a failure caused by Tasks 1-6.

- [ ] **Step 1: Run new focused tests**

```bash
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub exec \
  node --test --test-concurrency=1 \
  test/docker/resolve-runtime-environment.test.js docker/e2e-compose-test.js
node --test tools/release/credentialinghub-docker-metadata.test.js
```

- [ ] **Step 2: Run the complete Hub suite**

```bash
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub test
```

Expected: the existing suite passes unchanged alongside the resolver tests.

- [ ] **Step 3: Lint every affected JavaScript file and check diffs**

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix \
  servers/credentialinghub/docker/entrypoint.js \
  servers/credentialinghub/docker/resolve-runtime-environment.js \
  servers/credentialinghub/docker/velocity-network-presets.js \
  servers/credentialinghub/docker/e2e-compose-test.js \
  servers/credentialinghub/test/docker/resolve-runtime-environment.test.js \
  tools/release/credentialinghub-docker-metadata.js \
  tools/release/credentialinghub-docker-metadata.test.js
git diff --check
```

- [ ] **Step 4: Validate workflow and rebuild the final image**

```bash
actionlint .github/workflows/publish-packages.workflow.yml
servers/credentialinghub/docker/smoke-test.sh
```

- [ ] **Step 5: Run the existing full Hub E2E against the local production image**

```bash
docker compose --file servers/credentialinghub/e2e/docker-compose.yml \
  up --detach --build --wait
corepack $(node -p "require('./package.json').packageManager") \
  --filter @verii/server-credentialing-hub test:e2e
docker compose --file servers/credentialinghub/e2e/docker-compose.yml \
  down --volumes --remove-orphans
```

Use a cleanup trap. Expected: existing organization registration/issuing E2E passes with unchanged OAuth configuration.

- [ ] **Step 6: Confirm scope and repository integrity**

```bash
git diff origin/main...HEAD --name-only
git status --short
git log --show-signature --format=fuller origin/main..HEAD
```

Expected: no `servers/credentialagent` files or private image workflow changes; every implementation commit is signed off and signed; working tree is clean. Commit any verification fix separately with `--signoff`; never amend.
