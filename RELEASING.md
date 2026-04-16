# Releasing Verii

## Branch policy

- `main` is for the next minor line under active development.
- Each stabilizing minor line gets a long-lived branch named `release/X.Y.x`.
- Prod releases for a line are cut from the matching `release/X.Y.x` branch.
- Do not create one branch per patch version.

Example:
- Cut `release/1.1.x` from `main` when `1.1.0` enters stabilization.
- Bump `main` forward to the next minor version so next-line work continues there.
- Ship `v1.1.0`, `v1.1.1`, `v1.1.2` from release commits on `release/1.1.x`.

## Version source of truth

- `VERSION` is the committed source of truth for the release version being prepared.
- `main` may carry the upcoming release line's `VERSION` before the release branch is cut.
- Package manifests remain on repo-local placeholder versions and are rewritten in CI for publish.
- Release tags must point to the merged source commit that was actually shipped.

## Release notes policy

- Every release PR targeting `release/X.Y.x` must add or update `.github/releases/vX.Y.Z.md` for the version in `VERSION`.
- Release notes must include:
  - `## Changes`
  - at least one `### [#PR](...) ...` entry heading
  - `## Backward incompatibilities`
- The release-notes file is the source for the GitHub Release body.

## Release PR policy

- Release version bumps must land through a PR targeting the matching `release/X.Y.x` branch.
- Do not bump a prod release version through a PR targeting `main`.
- The merged release PR commit is the source of truth for the shipped tag and GitHub Release.

## Recommended flow

1. Set `VERSION` on `main` for the release line you are preparing.
2. Cut `release/X.Y.x` from `main`.
3. Bump `main` forward to the next minor version.
4. Prepare a release PR into `release/X.Y.x` with:
   - the matching `.github/releases/vX.Y.Z.md`
   - any release-line fixes that should ship in that version
5. Merge that PR into `release/X.Y.x`.
6. Run the prod publish workflow from the merged release-branch commit.
7. Cherry-pick or forward-port fixes between `release/X.Y.x` and `main` as needed.
