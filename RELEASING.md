# Releasing Verii

## Release Groups

Nx Release is configured in `nx.json` with fixed-version release groups:

- `platform`: `packages/*` and `tools/*`, excluding `packages/vnf-wallet-sdk-nodejs`
- `credentialagent`: `servers/credentialagent` and `servers/mockvendor`
- `sdk-nodejs`: `packages/vnf-wallet-sdk-nodejs`

`samples/*` and `contracts/*` are workspace reference material and are not published by Nx Release.

## Versions And Dependencies

Package manifests are the source of truth for released versions.

- `platform` packages publish together from the same version.
- `credentialagent` packages publish together from the same version.
- `sdk-nodejs` publishes independently from the other groups.
- Internal `@verii/*` dependencies use `workspace:*` in source manifests.
- pnpm converts `workspace:*` dependencies to package versions while packing and publishing.

## Version Plans

Feature PRs that touch releasable projects must include a version plan in `.nx/version-plans/*.md`.

Create a plan with:

```bash
pnpm exec nx release plan <major|minor|patch>
```

A single version plan can coordinate multiple groups. CI runs:

```bash
pnpm exec nx release plan:check --base=<base-sha> --head=HEAD
```

Docs, tests, workflow files, package manifests, lockfiles, and release config files are ignored by the version-plan check. Manifest and lockfile changes are ignored so generated prepare-release PRs do not require a second version plan after consuming the original plans.

## Dev Builds

`.github/workflows/publish-packages.workflow.yml` runs automatically on `main` changes under `packages/`, `servers/`, or `tools/`.

The workflow:

1. Versions all active release groups with Nx prerelease mode.
2. Uses `dev.<short-sha>` as the prerelease id.
3. Publishes to npm with the `dev` dist-tag.
4. Does not consume version plans.

## Preparing A Release

Run `.github/workflows/prepare-release.workflow.yml` manually.

The workflow:

1. Checks out the selected base branch.
2. Uses Nx Release to consume `.nx/version-plans/*.md`.
3. Updates package versions and dependency metadata.
4. Removes consumed version plans.
5. Opens a draft release PR.

The prepare workflow does not publish packages, create git tags, or create GitHub Releases.

## Promotion

Run `.github/workflows/publish-packages.workflow.yml` manually from the commit to promote. All npm publishing stays in this existing workflow filename so npm Trusted Publisher configuration does not need to change.

- `staging` publishes disposable prerelease versions from the selected commit with a `staging.<short-sha>` prerelease id and the npm `staging` dist-tag.
- `production` publishes the exact package versions from the selected commit with the npm `latest` dist-tag, creates group git tags, and creates GitHub Releases.

Staging does not consume version plans and does not create tags or GitHub Releases. Production uses the package versions already committed by the prepare-release PR.

## Tag Policy

Release group tags use these patterns:

- `platform-v{version}`
- `credentialagent-v{version}`
- `sdk-nodejs-v{version}`

For the Nx migration, create baseline tags at the commit pointed to by `v1.1.3`:

```bash
git tag platform-v1.1.3 v1.1.3
git tag credentialagent-v1.1.3 v1.1.3
git tag sdk-nodejs-v1.1.3 v1.1.3
git push origin platform-v1.1.3 credentialagent-v1.1.3 sdk-nodejs-v1.1.3
```

After the migration baselines ship, production promotion creates the real group tags for the shipped versions.
