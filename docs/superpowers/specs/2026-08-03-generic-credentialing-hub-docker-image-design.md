# Generic Credentialing Hub Docker Image Design

**Date:** 2026-08-03

**Status:** Approved

## Summary

Verii will publish a generic, environment-independent Credentialing Hub Docker
image to Docker Hub as `verii/credentialing-hub`. The image will be built
directly from the existing `@verii/server-credentialing-hub` workspace package
with a production Dockerfile and runtime entrypoint. No Docker wrapper package
will be added.

The image will accept individual runtime variables for an OAuth
client-credentials-protected Ethereum network. It will also provide
`--velocity-devnet`, `--velocity-testnet`, and `--velocity-mainnet` shortcuts
that install the public configuration for the corresponding Velocity Network.
The shortcuts never change the image contents and never select an image tag.

The private monorepo Credentialing Hub image build remains unchanged because
automated Velocity deployments still require it and the Hub will gain private
provider logic that cannot be published in the open-source image.

## Context

The existing `velocitycareerlabs/monorepo` workflow builds the Credentialing
Hub image for a particular Velocity environment. Its Dockerfile bakes values
from `eng/environments/dev.sh`, `staging.sh`, or `prod.sh` into the image.
Consequently, the artifact is tied to devnet, testnet, or mainnet before it
starts.

Verii now owns the Hub runtime package and its independent release version, but
does not own its production Docker distribution. The new image moves the
generic open-source distribution into Verii without replacing the private
deployment wrapper.

The shared RPC provider currently always obtains an OAuth token and sends a
Bearer header. True unauthenticated RPC support does not exist yet: the local
Besu E2E stack succeeds because it receives a dummy LocalAuth0 token and Besu
tolerates the extra header. Credentialing Hub-only no-auth support is tracked
separately in [LFDT-Verii/core#890](https://github.com/LFDT-Verii/core/issues/890)
and is not part of this design.

## Goals

- Publish `verii/credentialing-hub` to Docker Hub.
- Build the image directly from the Verii Credentialing Hub package and its
  production workspace dependency graph.
- Keep all network selection at container startup rather than image build time.
- Support arbitrary Ethereum networks protected by OAuth client credentials
  through individual runtime variables.
- Provide three mutually exclusive Velocity Network shortcuts containing the
  public devnet, testnet, and mainnet configuration.
- Reject ambiguous mixtures of shortcut-owned and individually supplied
  network configuration before the server starts.
- Preserve the legacy `VNF_*` runtime contract used by existing wrappers.
- Align Docker tags with the independent Credentialing Hub package release.
- Avoid routine Docker Hub prerelease churn by making prerelease image
  publishing explicitly opt-in.
- Exercise the publishable Credentialing Hub artifact in its E2E test.

## Non-goals

- Removing or changing the monorepo GHCR image builds.
- Open-sourcing private Credentialing Hub provider logic.
- Adding a Docker-specific server wrapper package.
- Publishing or changing a Credential Agent Docker image, workflow, E2E stack,
  documentation, or runtime behavior.
- Supporting unauthenticated blockchain RPC in the Hub image. Support is
  deferred to issue #890.
- Refactoring authentication setup in existing contract or RPC tests.
- Adding devnet, testnet, or mainnet Docker tags.
- Moving Credentialing Hub migrations into Verii. The former migration
  scaffolding has already been removed and its documentation is stale.

## Architecture

### Credentialing Hub production Dockerfile

A Hub-specific multi-stage Dockerfile under `servers/credentialinghub/docker/`
uses the repository's pinned package manager, installs the locked workspace,
and creates a production deployment containing only Credentialing Hub and its
workspace dependencies. The final stage contains that deployed tree plus the
runtime entrypoint.

The final image:

- uses the repository's supported Node 24 slim base image;
- runs as the non-root `node` user;
- sets only environment-independent defaults such as `NODE_ENV=production`,
  `HOST=0.0.0.0`, and `PORT=3000`;
- exposes port 3000;
- contains no network endpoints, contract addresses, public keys, OAuth
  credentials, or registry credentials baked into a layer;
- carries OCI source, revision, version, and Apache-2.0 license labels supplied
  as build metadata; and
- starts Credentialing Hub through the runtime entrypoint.

### Runtime entrypoint and resolver

The entrypoint is JavaScript so its parsing and validation rules can be tested
as pure logic. The pure resolver receives an argument list and environment
object and returns the environment additions required before loading the Hub's
existing `src/main.js`. The executable entrypoint applies those additions and
loads the server in the same Node process, preserving normal container signal
and exit behavior.

The entrypoint accepts zero or one of these exact arguments:

- `--velocity-devnet`
- `--velocity-testnet`
- `--velocity-mainnet`

Unknown arguments, more than one shortcut, or misspelled shortcuts such as a
three-dash form fail with a concise usage message before server startup. Users
who need another container command can override the Docker entrypoint.

With no shortcut, the resolver only maps generic OAuth variable aliases to the
Hub's existing internal names. All other application validation continues to
be owned by the existing server configuration.

### Velocity Network presets

Preset values are checked into Verii as source data. The initial values are a
snapshot of the public settings in the legacy monorepo at commit
`1b10884abb`, using `dev.sh` for devnet, `staging.sh` for testnet, and `prod.sh`
for mainnet.

Each preset owns these Hub runtime values:

- `RPC_NODE_URL`
- `CHAIN_ID`
- `REGISTRAR_URL`
- `REVOCATION_CONTRACT_ADDRESS`
- `METADATA_REGISTRY_CONTRACT_ADDRESS`
- `COUPON_CONTRACT_ADDRESS`
- `PERMISSIONS_CONTRACT_ADDRESS`
- `ROOT_PUBLIC_KEY`
- `VNF_OAUTH_TOKENS_ENDPOINT`
- `BLOCKCHAIN_API_AUDIENCE`
- `DEEP_LINK_PROTOCOL`
- `LIB_URL`
- `CREDENTIAL_EXTENSIONS_CONTEXT_URL`

The preset does not own deployment or secret values. Variables such as
`MONGO_URI`, `HOST_URL`, `PORT`, `LOG_SEVERITY`, TLS certificate paths,
Hub encryption secrets, CAO/operator settings, and OAuth client ID/secret
remain allowed and required according to the Hub's existing rules.

### Conflict rules

When a shortcut is present, startup fails if the environment contains any
preset-owned variable or its generic alias. The failure lists variable names
only and never prints their values. This rule is intentionally strict even if
an explicit value happens to equal the preset: a container uses either the
shortcut's public network configuration or individual network variables, not
both.

OAuth client ID and client secret are excluded from the conflict set because
they are deployment secrets and are not part of a preset.

Generic and legacy aliases for the same value are mutually exclusive in
no-shortcut mode. Supplying both forms fails rather than introducing a hidden
precedence rule.

## Runtime configuration contract

### Generic OAuth variables

The public Docker interface uses these generic names:

- `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT`
- `BLOCKCHAIN_OAUTH_CLIENT_ID`
- `BLOCKCHAIN_OAUTH_CLIENT_SECRET`
- `BLOCKCHAIN_OAUTH_AUDIENCE`

The entrypoint maps them to the existing application configuration:

| Public image variable | Existing application variable |
| --- | --- |
| `BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT` | `VNF_OAUTH_TOKENS_ENDPOINT` |
| `BLOCKCHAIN_OAUTH_CLIENT_ID` | `VNF_OAUTH_CLIENT_ID` |
| `BLOCKCHAIN_OAUTH_CLIENT_SECRET` | `VNF_OAUTH_CLIENT_SECRET` |
| `BLOCKCHAIN_OAUTH_AUDIENCE` | `BLOCKCHAIN_API_AUDIENCE` |

Existing `VNF_OAUTH_*` and `BLOCKCHAIN_API_AUDIENCE` variables continue to
work directly. This preserves compatibility for existing deployments while
giving the public image a network-neutral interface.

The OAuth flow remains the current client-credentials grant. Token acquisition,
per-CAO Credentialing Hub credential resolution, caching, and Bearer-header
forwarding are not changed by this work. OAuth failures never fall back to an
unauthenticated request.

### Generic network mode

Without a shortcut, callers supply the individual blockchain, contract,
network-service, application, and secret variables required by the Hub. This
mode can target an OAuth-protected Besu or other Ethereum JSON-RPC deployment.
It does not imply that every Ethereum deployment is compatible with Velocity
contracts or Hub semantics; the caller is responsible for supplying matching
deployed contract addresses and network services.

### Shortcut mode

With a shortcut, callers supply only deployment-specific application values
and OAuth client credentials. The preset supplies every public network value
listed above. All three shortcuts use OAuth client credentials. There are no
environment-specific image variants.

## Publishing and versioning

The existing `.github/workflows/publish-packages.workflow.yml` remains the
single release entrypoint. Docker publishing is conditional on the selected
Nx release groups:

- the `credentialinghub` group controls `verii/credentialing-hub`; and
- selecting any other release group does not build or publish the Hub image.

### Prerelease

Automatic `main` pushes continue publishing npm prereleases but do not publish
the Docker image. A new boolean workflow-dispatch input, defaulting to false,
allows a release operator to opt into Docker publishing during a manual
prerelease run. An opted-in image receives only its exact package prerelease
tag, for example `2.2.0-pre.1785474026.0`. It does not move `latest` and does
not receive a network name tag.

### Production

A manual production promotion always publishes the Docker image when the
`credentialinghub` release group is selected and its npm publication succeeds.
The image receives its exact stable package version and `latest`, for example
`2.2.0` and `latest`.

The version is read from the already-versioned package manifest in the same
job workspace used for npm publishing. This prevents an image tag from
diverging from the package version inside the image.

### Registry and platforms

The workflow logs into Docker Hub using dedicated `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` repository secrets. They are never passed into the build
context. Buildx publishes a manifest for `linux/amd64` and `linux/arm64`.

## E2E and CI integration

Credentialing Hub E2E builds the new production Dockerfile from the checked-out
commit instead of pulling a prerelease image. Testing the local build is a
release gate for the exact source under review and avoids making E2E dependent
on a publication that may not exist yet.

The Credentialing Hub Compose service removes its bind-mounted source,
workspace `node_modules`, and nodemon command. It builds the
`credentialinghub` production image locally and continues mounting only the
generated TLS certificate volume. Local E2E usage rebuilds after source changes
with the already documented `docker compose up --build` flow.

The current `.localdev.env` and LocalAuth0 setup remain unchanged. The Hub E2E
continues exercising OAuth client credentials against the local Besu node; it
does not become a no-auth test.

## Validation and error handling

The runtime resolver exits before loading the server when it encounters:

- an unknown or malformed argument;
- multiple Velocity shortcuts;
- a shortcut combined with a preset-owned environment variable or alias; or
- generic and legacy aliases for the same OAuth setting.

Errors identify the rule and offending variable names, provide the accepted
shortcut syntax where relevant, and omit all values. Once resolution succeeds,
existing server configuration remains authoritative for missing application or
secret variables.

Build and publish failures stop their release job. Production `latest` is
updated only as part of the same successful multi-platform publish that writes
the stable version tag.

## Testing strategy

Testing follows the project rule that pure logic receives unit tests and
orchestration or validation is exercised through its public boundary.

### Unit tests

Unit tests for the pure runtime resolver cover:

- no-shortcut pass-through;
- every Velocity preset;
- generic-to-legacy OAuth alias mapping;
- unknown, malformed, and multiple shortcuts;
- every preset-variable conflict class;
- allowed operational variables and OAuth client credentials; and
- generic/legacy alias collisions without secret-value leakage.

### Container smoke tests

Docker smoke tests build the Hub image from its production Dockerfile and
verify:

- the image runs as a non-root user;
- network values are absent from image configuration;
- invalid shortcut combinations fail through the real entrypoint; and
- the final image contains the Hub's production workspace dependency graph
  rather than the full repository workspace.

### Integration and regression checks

- Run the Credentialing Hub E2E stack using the locally built production
  image and existing LocalAuth0 flow.
- Run the existing Credentialing Hub test targets relevant to changed
  configuration and startup files.
- Run ESLint with `--fix` on every changed JavaScript file before verification.
- Run actionlint against the modified publishing and E2E workflows.
- Build both supported platforms through Buildx in CI; local verification may
  build the host platform before the workflow performs the full matrix.

No new no-auth tests belong to this change. Those tests are acceptance criteria
for issue #890. Existing contract and RPC tests remain unchanged.

## Documentation

The Credentialing Hub README will document:

- the Docker Hub image name;
- stable and prerelease tag behavior;
- a generic OAuth-protected network example;
- each Velocity shortcut example;
- the conflict rule and allowed secret/runtime variables; and
- the need to override the entrypoint for maintenance commands.

`RELEASING.md` will document the manual prerelease Docker opt-in, automatic
production publishing for the `credentialinghub` release group, tag policy,
multi-platform targets, and required Docker Hub secrets.

The stale Credentialing Hub migration section will be removed because neither
the Verii package nor the current monorepo wrapper contains that migration
scaffolding.

## Rollout and compatibility

The new Docker Hub repository is additive. Existing GHCR and ECR deployment
references continue to resolve to the monorepo-built artifact. Existing package
consumers and legacy `VNF_*` variables retain their behavior.

The first production publication writes the package version and `latest` tags.
Operators can validate a manually opted-in prerelease image before production.
Because the same image runs against all Velocity environments, promotion never
requires rebuilding for a different network.

## Security considerations

- No OAuth client secret, database URI, encryption secret, API token, or other
  deployment secret is included in an image layer or OCI label.
- Presets contain public network metadata only.
- Error messages never print environment values.
- The image runs as a non-root user.
- Docker base images and GitHub Actions remain digest-pinned according to the
  repository's existing dependency policy.
- OAuth failures cannot downgrade to an unauthenticated RPC request.
