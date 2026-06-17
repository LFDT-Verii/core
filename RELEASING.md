# Releasing Verii

## Release Anchors

Group git tags and GitHub Releases are the durable release anchors:

- `platform-vX.Y.Z`
- `credentialagent-vX.Y.Z`
- `sdk-nodejs-vX.Y.Z`

Branch names are operational only. Production publishing does not require a branch named after a version. For patch work, create a descriptive branch from the group tag being patched, such as `patch/platform-v1.2.1`.

## Release Lines

- `main` is always the next minor release line.
- Package manifests on `main` should stay at the latest stable release baseline for each group until a release-prep PR commits the next stable version.
- Automatic prerelease publishing from `main` uses Nx `preminor`, so each group publishes a prerelease on its next minor line.
- The initial Nx baselines are `platform` `1.1.3`, `credentialagent` `1.27.0`, and `sdk-nodejs` `2.9.0`, which produce `1.2.0-pre.<epoch>.0`, `1.28.0-pre.<epoch>.0`, and `2.10.0-pre.<epoch>.0` respectively.
- Patch branches start from released group tags, publish exact patch versions only, and never publish prerelease versions.
- Next-major work happens on dedicated branches, for example `major/platform-2`, `major/sdk-nodejs-3`, or a repo-wide `major/2`.

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

## Prerelease Builds

`.github/workflows/publish-packages.workflow.yml` runs automatically on `main` changes under `packages/`, `servers/`, or `tools/`.

The workflow:

1. Versions all active release groups with Nx `preminor` mode.
2. Uses `pre.<epoch-seconds>` as the prerelease id so newer builds sort after older builds.
3. Publishes to npm with the `prerelease` dist-tag.
4. Does not consume version plans.
5. Fails if run from any branch other than `main`.

## Preparing A Release

Run `.github/workflows/prepare-release.workflow.yml` manually. For a normal minor release train, use `main` as `base-branch`; for patch trains, use the patch branch created from the released tag; for next-major release trains, use the dedicated major branch.

The workflow:

1. Checks out the selected base branch.
2. Uses Nx Release to consume `.nx/version-plans/*.md`.
3. Updates package versions and dependency metadata.
4. Removes consumed version plans.
5. Opens a draft release PR.

The prepare workflow does not publish packages, create git tags, or create GitHub Releases.

Before a release PR is ready to merge for production, add release notes for each release group that will be promoted. Release notes live under `.github/releases/` and are named after the group tag that production promotion will create:

- `.github/releases/platform-vX.Y.Z.md`
- `.github/releases/credentialagent-vX.Y.Z.md`
- `.github/releases/sdk-nodejs-vX.Y.Z.md`

Each release-notes file must include:

```md
## Changes

### [#123](https://github.com/LFDT-Verii/core/pull/123) Product-friendly change summary

## Backward incompatibilities
```

Use `## Backward incompatibilities` even when there are none.

## Patch Trains

For a train of fixes against already released code:

1. Create a patch branch from the latest group tag you are patching, for example `git switch -c patch/platform-v1.2.1 platform-v1.2.0`.
2. Cherry-pick or apply the fixes onto that branch.
3. Add version plans for the affected release groups.
4. Run `.github/workflows/prepare-release.workflow.yml` with `base-branch` set to the patch branch.
5. Add release notes for the new group tag, for example `.github/releases/platform-v1.2.1.md`.
6. Merge the release PR into the patch branch.
7. Run production publishing for the affected groups.
8. Forward-port the fix commits back to `main`.

Patch branches do not publish prerelease versions. Keep releasing exact patch versions from the patch branch until the issue train is complete.

## Promotion

Run `.github/workflows/publish-packages.workflow.yml` manually from the commit to promote. All npm publishing stays in this existing workflow filename so npm Trusted Publisher configuration does not need to change.

- `prerelease` publishes disposable prerelease versions from the selected commit with a `pre.<epoch-seconds>` prerelease id and the npm `prerelease` dist-tag.
- `production` validates the checked-in release notes for each selected group, fails if any target group tag or GitHub Release already exists, publishes the exact package versions from the selected commit with the npm `latest` dist-tag, creates group git tags, and creates GitHub Releases from those notes.

Prerelease publishing does not consume version plans and does not create tags or GitHub Releases. Production uses the package versions already committed by the prepare-release PR.

## Tag Policy

Release group tags use these patterns:

- `platform-v{version}`
- `credentialagent-v{version}`
- `sdk-nodejs-v{version}`

For the Nx migration, create baseline group tags for the stable versions each group is starting from:

```bash
git tag platform-v1.1.3 v1.1.3
git tag credentialagent-v1.27.0 <credentialagent-baseline-commit>
git tag sdk-nodejs-v2.9.0 <sdk-nodejs-baseline-commit>
git push origin platform-v1.1.3 credentialagent-v1.27.0 sdk-nodejs-v2.9.0
```

After the migration baselines ship, production promotion creates the real group tags for the shipped versions.
