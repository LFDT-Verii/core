#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  projectRootsForGroup,
  readJson,
  releaseGroupInfo,
  repoRoot,
  requireOptionValue,
} = require('./release-utils');

const defaultGroups = 'platform,credentialagent,credentialinghub,sdk-nodejs';
const releaseTrainPath = '.github/release-train.json';
const generatedPlanName = 'verii-prerelease-train.md';
const validBumps = new Set(['major', 'minor', 'patch']);
const prereleaseBumps = {
  major: 'premajor',
  minor: 'preminor',
  patch: 'prepatch',
};

const usage = `Usage:
  pnpm run release:version-prerelease -- --groups credentialinghub --preid pre.123
  pnpm run release:version-prerelease -- --groups platform,credentialagent --preid pre.123 --dry-run
`;

const writeInfo = (message) => process.stderr.write(`${message}\n`);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const argParsers = {
  '--': ({ index, options }) => ({ index, options }),
  '--dry-run': ({ index, options }) => ({
    index,
    options: { ...options, dryRun: true },
  }),
  '--groups': ({ argv, index, options }) => ({
    index: index + 1,
    options: {
      ...options,
      groups: requireOptionValue(argv, index, '--groups'),
    },
  }),
  '-h': () => {
    process.stdout.write(usage);
    process.exit(0);
  },
  '--help': () => {
    process.stdout.write(usage);
    process.exit(0);
  },
  '--preid': ({ argv, index, options }) => ({
    index: index + 1,
    options: { ...options, preid: requireOptionValue(argv, index, '--preid') },
  }),
};

const parseArg = (options, argv, index) => {
  const arg = argv[index];
  const parse = argParsers[arg];

  if (!parse) {
    fail(`Unknown argument: ${arg}\n\n${usage}`);
  }

  return parse({ argv, index, options });
};

const parseArgsAt = (argv, index, options) => {
  if (index >= argv.length) {
    return options;
  }

  const parsed = parseArg(options, argv, index);

  return parseArgsAt(argv, parsed.index + 1, parsed.options);
};

const parseArgs = (argv) => {
  const options = {
    dryRun: false,
    groups: defaultGroups,
    preid: null,
  };

  return parseArgsAt(argv, 0, options);
};

const parseVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Invalid stable version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const bumpVersion = (version, bump) => {
  const parsed = parseVersion(version);

  if (bump === 'major') {
    return `${parsed.major + 1}.0.0`;
  }

  if (bump === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }

  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
};

const prereleaseBump = (bump) => {
  const mapped = prereleaseBumps[bump];

  if (!mapped) {
    throw new Error(`Unsupported release train bump: ${bump}`);
  }

  return mapped;
};

const normalizeGroups = (groupsValue, releaseGroups) => {
  const groups = groupsValue
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  const unknownGroups = groups.filter((group) => !releaseGroups[group]);

  if (groups.length === 0) {
    throw new Error('At least one release group is required.');
  }

  if (unknownGroups.length > 0) {
    throw new Error(`Unknown release group(s): ${unknownGroups.join(', ')}`);
  }

  return groups;
};

const validateSelectedGroups = (selectedGroups, releaseGroups) => {
  const releaseGroupNames = Object.keys(releaseGroups);

  if (
    selectedGroups.includes('platform') &&
    selectedGroups.length !== releaseGroupNames.length
  ) {
    throw new Error(
      'Platform prerelease versioning updates dependent release groups; select all release groups to publish the platform train.',
    );
  }
};

const loadReleaseTrain = () => readJson(releaseTrainPath);

const assertReleaseTrainShape = (releaseTrain) => {
  if (releaseTrain.kind !== 'verii-release-train') {
    throw new Error(
      `${releaseTrainPath} must set kind to "verii-release-train".`,
    );
  }

  if (
    !releaseTrain.groups ||
    typeof releaseTrain.groups !== 'object' ||
    Array.isArray(releaseTrain.groups)
  ) {
    throw new Error(`${releaseTrainPath} must contain a groups object.`);
  }
};

const assertReleaseTrainGroups = (releaseTrain, releaseGroups) => {
  const configuredGroups = Object.keys(releaseTrain.groups);
  const releaseGroupNames = Object.keys(releaseGroups);
  const missingGroups = releaseGroupNames.filter(
    (group) => !configuredGroups.includes(group),
  );
  const unknownGroups = configuredGroups.filter(
    (group) => !releaseGroups[group],
  );

  if (missingGroups.length > 0) {
    throw new Error(
      `${releaseTrainPath} is missing release group(s): ${missingGroups.join(', ')}`,
    );
  }

  if (unknownGroups.length > 0) {
    throw new Error(
      `${releaseTrainPath} contains unknown release group(s): ${unknownGroups.join(', ')}`,
    );
  }
};

const validateReleaseTrain = (releaseTrain, releaseGroups) => {
  assertReleaseTrainShape(releaseTrain);
  assertReleaseTrainGroups(releaseTrain, releaseGroups);
};

const releaseTrainEntry = (releaseTrain, group, groupInfo) => {
  const entry = releaseTrain.groups[group];

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`${releaseTrainPath} group ${group} must be an object.`);
  }

  if (!validBumps.has(entry.bump)) {
    throw new Error(
      `${releaseTrainPath} group ${group} bump must be one of: ${[...validBumps].join(', ')}`,
    );
  }

  const expectedTargetVersion = bumpVersion(groupInfo.version, entry.bump);

  if (entry.targetVersion !== expectedTargetVersion) {
    throw new Error(
      `${releaseTrainPath} group ${group} targetVersion must be ${expectedTargetVersion} for a ${entry.bump} bump from ${groupInfo.version}.`,
    );
  }

  return {
    bump: entry.bump,
    prereleaseBump: prereleaseBump(entry.bump),
    targetVersion: entry.targetVersion,
  };
};

const versionPlanContent = (targets) => {
  const frontMatter = targets
    .map(({ group, prereleaseBump: bump }) => `${group}: ${bump}`)
    .join('\n');
  const summary = targets
    .map(({ group, targetVersion }) => `- ${group} ${targetVersion}`)
    .join('\n');

  return `---\n${frontMatter}\n---\n\nPrepare prerelease train:\n\n${summary}\n`;
};

const writeVersionPlan = (targets) => {
  const versionPlansDir = path.join(repoRoot, '.nx', 'version-plans');
  const versionPlanFile = path.join(versionPlansDir, generatedPlanName);

  fs.mkdirSync(versionPlansDir, { recursive: true });

  const existingPlans = fs
    .readdirSync(versionPlansDir)
    .filter((file) => file.endsWith('.md') && file !== generatedPlanName);

  if (existingPlans.length > 0) {
    throw new Error(
      `Refusing to run prerelease versioning with existing version plans:\n${existingPlans
        .map((file) => `- .nx/version-plans/${file}`)
        .join('\n')}`,
    );
  }

  fs.writeFileSync(versionPlanFile, versionPlanContent(targets), 'utf8');
  writeInfo(`Wrote ${path.relative(repoRoot, versionPlanFile)}.`);

  return versionPlanFile;
};

const runCommand = (command, args) => {
  writeInfo(`$ ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
};

const runNxVersion = ({ dryRun, groups, preid }) => {
  const { packageManager } = readJson('package.json');
  const args = [
    packageManager,
    'exec',
    'nx',
    'release',
    'version',
    '--groups',
    groups.join(','),
    '--preid',
    preid,
    '--git-commit=false',
    '--git-tag=false',
    '--stage-changes=false',
  ];

  if (dryRun) {
    args.push('--dry-run');
  }

  runCommand('corepack', args);
};

const verifyPreparedVersions = (targets, preid, releaseGroups) => {
  targets.forEach(({ group, targetVersion }) => {
    const expectedVersion = `${targetVersion}-${preid}.0`;
    const wrongRoots = projectRootsForGroup(releaseGroups[group]).filter(
      (root) => {
        const manifest = readJson(path.join(root, 'package.json'));
        return manifest.version !== expectedVersion;
      },
    );

    if (wrongRoots.length > 0) {
      throw new Error(
        `Release group ${group} did not prepare ${expectedVersion} in: ${wrongRoots.join(', ')}`,
      );
    }
  });
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));

  if (!options.preid) {
    throw new Error(`Missing required --preid.\n\n${usage}`);
  }

  const nxJson = readJson('nx.json');
  const releaseGroups = nxJson.release?.groups ?? {};
  const selectedGroups = normalizeGroups(options.groups, releaseGroups);
  const releaseTrain = loadReleaseTrain();

  validateSelectedGroups(selectedGroups, releaseGroups);
  validateReleaseTrain(releaseTrain, releaseGroups);

  const targets = selectedGroups.map((group) => {
    const groupInfo = releaseGroupInfo(group, releaseGroups[group]);

    return {
      group,
      ...releaseTrainEntry(releaseTrain, group, groupInfo),
    };
  });
  const versionPlanFile = writeVersionPlan(targets);

  try {
    runNxVersion({
      dryRun: options.dryRun,
      groups: selectedGroups,
      preid: options.preid,
    });

    if (!options.dryRun) {
      verifyPreparedVersions(targets, options.preid, releaseGroups);
    }
  } finally {
    fs.rmSync(versionPlanFile, { force: true });
  }

  writeInfo('Prerelease versioning complete.');
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(error.message);
  }
}

module.exports = {
  bumpVersion,
  normalizeGroups,
  parseVersion,
  prereleaseBump,
  releaseTrainEntry,
  validateReleaseTrain,
  validateSelectedGroups,
  versionPlanContent,
};
