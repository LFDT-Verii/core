# Releasing Verii

## Release Anchors

Group git tags and GitHub Releases are the durable release anchors:

- `platform-vX.Y.Z`
- `credentialagent-vX.Y.Z`
- `credentialinghub-vX.Y.Z`
- `sdk-nodejs-vX.Y.Z`

Branch names are operational only. Production publishing does not require a branch named after a version. For patch work, create a descriptive branch from the group tag being patched, such as `patch/platform-v1.2.1`.

## Release Lines

- `main` is always the next minor release line.
- Package manifests on `main` should stay at the latest stable release baseline for each group until a release-prep PR commits the next stable version.
- Automatic prerelease publishing from `main` uses Nx `preminor`, so each group publishes a prerelease on its next minor line.
- Manual prerelease publishing from `main` can use `prepatch` when the release manager needs a disposable patch prerelease from the current stable baseline, for example `credentialinghub` `2.0.0` to `2.0.1-pre.<epoch>.0`.
- The initial Nx baselines are `platform` `1.1.3`, `credentialagent` `1.27.0`, `credentialinghub` `2.0.0`, and `sdk-nodejs` `2.9.0`, which produce `1.2.0-pre.<epoch>.0`, `1.28.0-pre.<epoch>.0`, `2.1.0-pre.<epoch>.0`, and `2.10.0-pre.<epoch>.0` respectively.
- Patch branches start from released group tags, publish exact patch versions only, and never publish prerelease versions.
- Next-major work happens on dedicated branches, for example `major/platform-2`, `major/sdk-nodejs-3`, or a repo-wide `major/2`.

## Release Groups

Nx Release is configured in `nx.json` with fixed-version release groups:

- `platform`: `packages/*` and `tools/*`, excluding `packages/vnf-wallet-sdk-nodejs`
- `credentialagent`: `servers/credentialagent` and `servers/mockvendor`
- `credentialinghub`: `servers/credentialinghub`
- `sdk-nodejs`: `packages/vnf-wallet-sdk-nodejs`

`samples/*` and `contracts/*` are workspace reference material and are not published by Nx Release.

## Versions And Dependencies

Package manifests are the source of truth for released versions.

- `platform` packages publish together from the same version.
- `credentialagent` packages publish together from the same version.
- `credentialinghub` publishes independently from the other groups.
- `sdk-nodejs` publishes independently from the other groups.
- Internal `@verii/*` dependencies use `workspace:*` in source manifests.
- pnpm converts `workspace:*` dependencies to package versions while packing and publishing.

## Release Bumps

Feature PRs do not need to include version plans. The release manager chooses the release groups and semver bump when preparing a release branch.

Use the root npm script to prepare release package versions and release metadata:

```bash
pnpm run release:prepare -- --groups <group> --bump <major|minor|patch> --message "Prepare release"
```

The script computes the target group versions, creates an Nx version plan internally for the selected groups, consumes it immediately, removes consumed version plans, writes `.github/release.json`, creates any missing release-note templates, and leaves the changes unstaged for review. For a preview, add `--dry-run`.

A single prepare run can coordinate multiple groups by passing a comma-separated `groups` value.

## Prerelease Builds

`.github/workflows/publish-packages.workflow.yml` runs automatically on `main` changes under `packages/`, `servers/`, or `tools/`.

The workflow:

1. Versions all active release groups with Nx `preminor` mode by default. Manual workflow runs can select `prepatch` for a patch prerelease.
2. Uses `pre.<epoch-seconds>` as the prerelease id so newer builds sort after older builds.
3. Publishes to npm with the `prerelease` dist-tag.
4. Does not consume version plans.
5. Fails if run from any branch other than `main`.

To publish a credentialing hub patch prerelease from the current `2.0.0` baseline, run the workflow manually from `main` with:

- `environment`: `prerelease`
- `groups`: `credentialinghub`
- `prerelease_bump`: `prepatch`

That produces a package version like `2.0.1-pre.<epoch>.0` and does not create git tags or GitHub Releases.

## Preparing A Release

Create a release branch from the line being released. For a normal minor release train, branch from `main` and use `minor` as `bump`; for patch trains, branch from the released group tag and use `patch` as `bump`; for next-major release trains, branch from the dedicated major branch and use `major` as `bump`.

Run the prepare script:

```bash
pnpm run release:prepare -- --groups <group> --bump <major|minor|patch> --message "Prepare release"
```

The script creates `.github/release.json`, which identifies the PR as a release PR and records the selected groups and target versions:

```json
{
  "kind": "verii-release",
  "bump": "minor",
  "groups": {
    "sdk-nodejs": "2.10.0"
  }
}
```

It also creates missing release-note templates for each release group that will be promoted. Release notes live under `.github/releases/` and are named after the group tag that production promotion will create:

- `.github/releases/platform-vX.Y.Z.md`
- `.github/releases/credentialagent-vX.Y.Z.md`
- `.github/releases/credentialinghub-vX.Y.Z.md`
- `.github/releases/sdk-nodejs-vX.Y.Z.md`

Each release-notes file must include:

```md
## Changes

### [#123](https://github.com/LFDT-Verii/core/pull/123) Product-friendly change summary

## Backward incompatibilities
```

Use `## Backward incompatibilities` even when there are none.

Productize the generated release-note template before opening the PR. Release PR validation fails while placeholder text remains.

The script:

1. Computes the target version for each selected release group.
2. Creates `.github/release.json` with the selected groups and target versions.
3. Creates an Nx version plan from the selected groups, bump, and message.
4. Uses Nx Release to consume that generated version plan.
5. Updates package versions and dependency metadata.
6. Removes consumed version plans.
7. Creates any missing release-note templates.
8. Verifies the selected group packages ended at the expected versions.

The prepare script does not publish packages, create git tags, create GitHub Releases, stage changes, commit changes, push a branch, or open a PR. Commit the version and release-note changes and open the release PR normally.

Release PR validation runs when `.github/release.json` changes. It verifies:

- `.github/release.json` has `kind: "verii-release"`.
- All groups in `.github/release.json` are valid Nx release groups.
- Versions in `.github/release.json` are stable semver versions.
- Selected group package manifests match the manifest versions.
- Matching release notes exist for every selected group and target version.
- Release notes have the required sections and no template placeholder text.
- No `.nx/version-plans/*.md` files are committed.
- The release PR diff only includes release-prep files: package manifests, `pnpm-lock.yaml`, `.github/release.json`, and `.github/releases/*.md`.

## Patch Trains

For a train of fixes against already released code:

1. Create a patch branch from the latest group tag you are patching, for example `git switch -c patch/platform-v1.2.1 platform-v1.2.0`.
2. Cherry-pick or apply the fixes onto that branch.
3. Run `pnpm run release:prepare -- --groups <group> --bump patch --message "Prepare patch release"`.
4. Productize the generated release notes for the new group tag, for example `.github/releases/platform-v1.2.1.md`.
5. Open and merge the validated release PR into the patch branch.
6. Run production publishing for the affected groups.
7. Forward-port the fix commits back to `main`.

Patch branches do not publish prerelease versions. Keep releasing exact patch versions from the patch branch until the issue train is complete.

## Promotion

Run `.github/workflows/publish-packages.workflow.yml` manually from the commit to promote. All npm publishing stays in this existing workflow filename so npm Trusted Publisher configuration does not need to change.

- `prerelease` publishes disposable prerelease versions from the selected commit with a `pre.<epoch-seconds>` prerelease id and the npm `prerelease` dist-tag. Manual runs default to `preminor` and can select `prepatch`.
- `production` validates the checked-in release notes for each selected group, fails if any target group tag or GitHub Release already exists, publishes the exact package versions from the selected commit with the npm `latest` dist-tag, creates group git tags, and creates GitHub Releases from those notes.

Prerelease publishing does not consume version plans and does not create tags or GitHub Releases. Production uses the package versions already committed by the prepare-release PR.

## Tag Policy

Release group tags use these patterns:

- `platform-v{version}`
- `credentialagent-v{version}`
- `credentialinghub-v{version}`
- `sdk-nodejs-v{version}`

For the Nx migration, create baseline group tags at the commit pointed to by `v1.1.3`:

```bash
git tag platform-v1.1.3 v1.1.3
git tag credentialagent-v1.27.0 v1.1.3
git tag sdk-nodejs-v2.9.0 v1.1.3
git push origin platform-v1.1.3 credentialagent-v1.27.0 sdk-nodejs-v2.9.0
```

After the migration baselines ship, production promotion creates the real group tags for the shipped versions.
