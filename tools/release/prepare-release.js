#!/usr/bin/env node

/* eslint-disable complexity */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  readJson,
  releaseGroupInfo,
  repoRoot,
  requireOptionValue,
} = require('./release-utils');

const defaultGroups = 'platform,credentialagent,credentialinghub,sdk-nodejs';
const releaseManifestFile = path.join(repoRoot, '.github', 'release.json');
const validBumps = new Set(['major', 'minor', 'patch']);

const usage = `Usage:
  pnpm run release:prepare -- --groups sdk-nodejs --bump minor --message "Prepare sdk release"
  pnpm run release:prepare -- --groups platform,credentialagent --bump patch
  pnpm run release:prepare -- --groups sdk-nodejs --bump minor --dry-run
`;

const writeInfo = (message) => process.stderr.write(`${message}\n`);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const options = {
    bump: 'minor',
    dryRun: false,
    groups: defaultGroups,
    message: 'Prepare release',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      // pnpm passes the argument separator through for scripts that already
      // have arguments in package.json.
    } else if (arg === '--bump') {
      options.bump = requireOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--groups') {
      options.groups = requireOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage);
      process.exit(0);
    } else if (arg === '--message') {
      options.message = requireOptionValue(argv, index, arg);
      index += 1;
    } else {
      fail(`Unknown argument: ${arg}\n\n${usage}`);
    }
  }

  return options;
};

const normalizeGroups = (groupsValue, releaseGroups) => {
  const groups = groupsValue
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  const unknownGroups = groups.filter((group) => !releaseGroups[group]);

  if (groups.length === 0) {
    fail('At least one release group is required.');
  }

  if (unknownGroups.length > 0) {
    fail(`Unknown release group(s): ${unknownGroups.join(', ')}`);
  }

  return groups;
};

const parseVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);

  if (!match) {
    fail(`Invalid package version: ${version}`);
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

const releaseTarget = (groupInfo, version) => {
  const tag = groupInfo.tagPattern.replace('{version}', version);

  return {
    group: groupInfo.group,
    releaseNotesFile: path.join(repoRoot, '.github', 'releases', `${tag}.md`),
    tag,
    version,
  };
};

const releaseManifest = (bump, targets) => {
  const groups = Object.fromEntries(
    targets.map(({ group, version }) => [group, version]),
  );

  return {
    kind: 'verii-release',
    bump,
    groups,
  };
};

const releaseNotesTemplate = () => `## Changes

### [#PR](https://github.com/LFDT-Verii/core/pull/PR) Product-friendly change summary

TODO: Describe the product impact of this release for downstream teams.

## Backward incompatibilities

TODO: List any breaking changes, or write "None."
`;

const writeReleaseManifest = (bump, targets) => {
  fs.mkdirSync(path.dirname(releaseManifestFile), { recursive: true });
  fs.writeFileSync(
    releaseManifestFile,
    `${JSON.stringify(releaseManifest(bump, targets), null, 2)}\n`,
    'utf8',
  );
  writeInfo(`Wrote ${path.relative(repoRoot, releaseManifestFile)}.`);
};

const writeReleaseNotesTemplates = (targets) => {
  targets.forEach((target) => {
    fs.mkdirSync(path.dirname(target.releaseNotesFile), { recursive: true });

    if (fs.existsSync(target.releaseNotesFile)) {
      writeInfo(
        `Keeping existing ${path.relative(repoRoot, target.releaseNotesFile)}.`,
      );
      return;
    }

    fs.writeFileSync(target.releaseNotesFile, releaseNotesTemplate(), 'utf8');
    writeInfo(`Created ${path.relative(repoRoot, target.releaseNotesFile)}.`);
  });
};

const removeVersionPlans = () => {
  const versionPlansDir = path.join(repoRoot, '.nx', 'version-plans');

  fs.mkdirSync(versionPlansDir, { recursive: true });
  fs.readdirSync(versionPlansDir)
    .filter((file) => file.endsWith('.md'))
    .forEach((file) => fs.rmSync(path.join(versionPlansDir, file)));
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
    process.exit(result.status ?? 1);
  }
};

const runNx = (args) => {
  const { packageManager } = readJson('package.json');

  runCommand('corepack', [packageManager, 'exec', 'nx', ...args]);
};

const verifyPreparedVersions = (groupInfos, expectedTargets) => {
  const expectedByGroup = new Map(
    expectedTargets.map(({ group, version }) => [group, version]),
  );

  groupInfos.forEach(({ group, roots }) => {
    const expectedVersion = expectedByGroup.get(group);
    const wrongRoots = roots.filter((root) => {
      const manifest = readJson(path.join(root, 'package.json'));
      return manifest.version !== expectedVersion;
    });

    if (wrongRoots.length > 0) {
      fail(
        `Release group ${group} did not prepare ${expectedVersion} in: ${wrongRoots.join(', ')}`,
      );
    }
  });
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));

  if (!validBumps.has(options.bump)) {
    fail(
      `Invalid bump '${options.bump}'. Expected one of: ${[...validBumps].join(', ')}`,
    );
  }

  const nxJson = readJson('nx.json');
  const releaseGroups = nxJson.release?.groups ?? {};
  const selectedGroups = normalizeGroups(options.groups, releaseGroups);
  const groupInfos = selectedGroups.map((group) =>
    releaseGroupInfo(group, releaseGroups[group]),
  );
  const targets = groupInfos.map((groupInfo) =>
    releaseTarget(groupInfo, bumpVersion(groupInfo.version, options.bump)),
  );

  if (options.dryRun) {
    writeInfo('Release preparation dry run:');
    targets.forEach(({ group, releaseNotesFile, tag, version }) => {
      writeInfo(
        `- ${group} ${version} (${tag}) -> ${path.relative(repoRoot, releaseNotesFile)}`,
      );
    });
    return;
  }

  removeVersionPlans();
  runNx([
    'release',
    'plan',
    options.bump,
    '--groups',
    selectedGroups.join(','),
    '--onlyTouched=false',
    '--message',
    options.message,
  ]);
  runNx([
    'release',
    'version',
    '--groups',
    selectedGroups.join(','),
    '--git-commit=false',
    '--git-tag=false',
    '--stage-changes=false',
  ]);
  removeVersionPlans();
  verifyPreparedVersions(groupInfos, targets);
  writeReleaseManifest(options.bump, targets);
  writeReleaseNotesTemplates(targets);
  writeInfo(
    'Release preparation complete. Productize the release notes before opening the PR.',
  );
};

try {
  main();
} catch (error) {
  fail(error.message);
}
