#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  assertFixedReleaseGroup,
  projectRootsForGroup,
  readJson,
  releaseTag,
  repoRoot,
  requireOptionValue,
} = require('./release-utils');

const releaseManifestPath = '.github/release.json';
const releaseManifestFile = path.join(repoRoot, releaseManifestPath);
const validBumps = new Set(['major', 'minor', 'patch']);
const placeholderPattern =
  /TODO|TBD|#PR|\/pull\/PR|Product-friendly change summary|Describe the product impact/i;

const usage = `Usage:
  pnpm run release:validate-pr -- --base origin/main
  pnpm run release:validate-pr
`;

const writeInfo = (message) => process.stderr.write(`${message}\n`);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const options = {
    base: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      // pnpm passes the argument separator through for scripts that already
      // have arguments in package.json.
    } else if (arg === '--base') {
      options.base = requireOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}\n\n${usage}`);
    }
  }

  return options;
};

const runGit = (args) => {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    fail(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
};

const changedFiles = (base) => {
  if (!base) {
    return [];
  }

  return runGit(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
};

const isReleasePr = (files, hasBase) => {
  if (!hasBase) {
    return true;
  }

  return files.includes(releaseManifestPath);
};

const isAllowedReleaseFile = (file) =>
  file === releaseManifestPath ||
  file === 'package.json' ||
  file === 'pnpm-lock.yaml' ||
  /^\.github\/releases\/[^/]+\.md$/.test(file) ||
  /^(packages|servers|tools)\/[^/]+\/package\.json$/.test(file);

const validateChangedFiles = (files) => {
  if (files.length === 0) {
    return;
  }

  const disallowed = files.filter((file) => !isAllowedReleaseFile(file));

  if (disallowed.length > 0) {
    fail(
      `Release PR includes files outside the release-prep allowlist:\n${disallowed
        .map((file) => `- ${file}`)
        .join('\n')}`,
    );
  }
};

const normalizeGroups = (groupsValue, releaseGroups) => {
  if (
    !groupsValue ||
    typeof groupsValue !== 'object' ||
    Array.isArray(groupsValue)
  ) {
    fail(`${releaseManifestPath} must contain a groups object.`);
  }

  const groups = Object.keys(groupsValue);
  const unknownGroups = groups.filter((group) => !releaseGroups[group]);

  if (groups.length === 0) {
    fail(`${releaseManifestPath} must list at least one release group.`);
  }

  if (unknownGroups.length > 0) {
    fail(`Unknown release group(s): ${unknownGroups.join(', ')}`);
  }

  return groups;
};

const isStableVersion = (version) => /^\d+\.\d+\.\d+$/.test(version);

const validatePackageVersions = (group, groupConfig, version) => {
  const roots = projectRootsForGroup(groupConfig);

  if (roots.length === 0) {
    fail(`Release group ${group} does not include any package manifests.`);
  }

  const mismatchedRoots = roots.filter((root) => {
    const manifest = readJson(path.join(root, 'package.json'));
    return manifest.version !== version;
  });

  if (mismatchedRoots.length > 0) {
    fail(
      `Release group ${group} must have version ${version} in:\n${mismatchedRoots
        .map((root) => `- ${root}/package.json`)
        .join('\n')}`,
    );
  }
};

const validateReleaseNotes = (group, groupConfig, version) => {
  const tag = releaseTag(group, groupConfig, version);
  const releaseNotesPath = `.github/releases/${tag}.md`;
  const releaseNotesFile = path.join(repoRoot, releaseNotesPath);

  if (!fs.existsSync(releaseNotesFile)) {
    fail(`Missing release notes for ${group} ${version}: ${releaseNotesPath}`);
  }

  const content = fs.readFileSync(releaseNotesFile, 'utf8');

  if (!/^## Changes$/m.test(content)) {
    fail(`${releaseNotesPath} is missing a '## Changes' section.`);
  }

  if (!/^## Backward incompatibilities$/m.test(content)) {
    fail(
      `${releaseNotesPath} is missing a '## Backward incompatibilities' section.`,
    );
  }

  if (!/^### \[#[^\]]+\]\([^)]+\)( .*)?$/m.test(content)) {
    fail(
      `${releaseNotesPath} must include at least one release entry heading in the form '### [#PR](...) ...'.`,
    );
  }

  if (placeholderPattern.test(content)) {
    fail(`${releaseNotesPath} still contains release-note template text.`);
  }
};

const validateNoVersionPlans = () => {
  const versionPlansDir = path.join(repoRoot, '.nx', 'version-plans');

  if (!fs.existsSync(versionPlansDir)) {
    return;
  }

  const versionPlans = fs
    .readdirSync(versionPlansDir)
    .filter((file) => file.endsWith('.md'));

  if (versionPlans.length > 0) {
    fail(
      `Release PR must not commit Nx version plans:\n${versionPlans
        .map((file) => `- .nx/version-plans/${file}`)
        .join('\n')}`,
    );
  }
};

const validateManifest = (manifest, releaseGroups) => {
  if (manifest.kind !== 'verii-release') {
    fail(`${releaseManifestPath} must set kind to "verii-release".`);
  }

  if (!validBumps.has(manifest.bump)) {
    fail(
      `${releaseManifestPath} bump must be one of: ${[...validBumps].join(', ')}`,
    );
  }

  const groups = normalizeGroups(manifest.groups, releaseGroups);

  groups.forEach((group) => {
    const version = manifest.groups[group];

    if (!isStableVersion(version)) {
      fail(
        `${releaseManifestPath} has invalid stable version for ${group}: ${version}`,
      );
    }

    assertFixedReleaseGroup(group, releaseGroups[group]);
    validatePackageVersions(group, releaseGroups[group], version);
    validateReleaseNotes(group, releaseGroups[group], version);
  });
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const files = changedFiles(options.base);

  if (!isReleasePr(files, Boolean(options.base))) {
    writeInfo(
      'No release manifest change detected; skipping release PR validation.',
    );
    return;
  }

  if (!fs.existsSync(releaseManifestFile)) {
    fail(`Missing ${releaseManifestPath}.`);
  }

  validateChangedFiles(files);
  validateNoVersionPlans();

  const nxJson = readJson('nx.json');
  const releaseGroups = nxJson.release?.groups ?? {};
  const manifest = readJson(releaseManifestPath);

  validateManifest(manifest, releaseGroups);
  writeInfo('Release PR validation passed.');
};

try {
  main();
} catch (error) {
  fail(error.message);
}
