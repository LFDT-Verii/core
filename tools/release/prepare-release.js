#!/usr/bin/env node

/* eslint-disable better-mutation/no-mutating-methods, complexity */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const defaultGroups = 'platform,credentialagent,credentialinghub,sdk-nodejs';
const validBumps = new Set(['major', 'minor', 'patch']);

const usage = `Usage:
  pnpm run release:prepare -- --groups sdk-nodejs --bump minor --message "Prepare sdk release"
  pnpm run release:prepare -- --groups platform,credentialagent --bump patch
  pnpm run release:prepare -- --groups sdk-nodejs --bump minor --dry-run
  pnpm run release:validate-notes -- --groups sdk-nodejs --output /tmp/release-groups.tsv
`;

const writeInfo = (message) => process.stderr.write(`${message}\n`);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));

const parseArgs = (argv) => {
  const options = {
    bump: 'minor',
    dryRun: false,
    groups: defaultGroups,
    message: 'Prepare release',
    output: null,
    validateCurrent: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      // pnpm passes the argument separator through for scripts that already
      // have arguments in package.json.
    } else if (arg === '--bump') {
      index += 1;
      options.bump = argv[index];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--groups') {
      index += 1;
      options.groups = argv[index];
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage);
      process.exit(0);
    } else if (arg === '--message') {
      index += 1;
      options.message = argv[index];
    } else if (arg === '--output') {
      index += 1;
      options.output = argv[index];
    } else if (arg === '--validate-current') {
      options.validateCurrent = true;
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

const expandDirectoryPattern = (pattern) => {
  if (!pattern.includes('*')) {
    return [pattern];
  }

  const starIndex = pattern.indexOf('*');
  const prefix = pattern.slice(0, starIndex).replace(/\/$/, '');
  const suffix = pattern.slice(starIndex + 1);
  const parent = path.join(repoRoot, prefix || '.');

  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(prefix, entry.name) + suffix);
};

const expandProjectSpec = (spec) => {
  if (!spec.startsWith('directory:')) {
    fail(`Unsupported release project spec: ${spec}`);
  }

  return expandDirectoryPattern(spec.slice('directory:'.length));
};

const projectRootsForGroup = (groupConfig) => {
  const specs = groupConfig.projects ?? [];
  const included = specs
    .filter((spec) => !spec.startsWith('!'))
    .flatMap(expandProjectSpec);
  const excluded = new Set(
    specs
      .filter((spec) => spec.startsWith('!'))
      .flatMap((spec) => expandProjectSpec(spec.slice(1))),
  );

  return included
    .filter((root) => !excluded.has(root))
    .filter((root) => fs.existsSync(path.join(repoRoot, root, 'package.json')))
    .sort();
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

const releaseGroupInfo = (group, groupConfig) => {
  const roots = projectRootsForGroup(groupConfig);

  if (roots.length === 0) {
    fail(`Release group ${group} does not include any package manifests.`);
  }

  const manifests = roots.map((root) => ({
    root,
    manifest: readJson(path.join(root, 'package.json')),
  }));
  const versions = [
    ...new Set(manifests.map(({ manifest }) => manifest.version)),
  ];

  if (groupConfig.projectsRelationship === 'fixed' && versions.length !== 1) {
    fail(
      `Release group ${group} has multiple current versions: ${versions.join(', ')}`,
    );
  }

  return {
    group,
    roots,
    tagPattern: groupConfig.releaseTag?.pattern ?? `${group}-v{version}`,
    version: versions[0],
  };
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

const validateReleaseNotes = ({ group, releaseNotesFile, tag, version }) => {
  if (!fs.existsSync(releaseNotesFile)) {
    fail(
      `Missing release notes for ${group} ${version}: ${path.relative(repoRoot, releaseNotesFile)}`,
    );
  }

  const content = fs.readFileSync(releaseNotesFile, 'utf8');

  if (!/^## Changes$/m.test(content)) {
    fail(
      `${path.relative(repoRoot, releaseNotesFile)} is missing a '## Changes' section.`,
    );
  }

  if (!/^## Backward incompatibilities$/m.test(content)) {
    fail(
      `${path.relative(repoRoot, releaseNotesFile)} is missing a '## Backward incompatibilities' section.`,
    );
  }

  if (!/^### \[#[^\]]+\]\([^)]+\)( .*)?$/m.test(content)) {
    fail(
      `${path.relative(
        repoRoot,
        releaseNotesFile,
      )} must include at least one release entry heading in the form '### [#PR](...) ...'.`,
    );
  }

  writeInfo(`Validated release notes for ${group} ${version} (${tag}).`);
};

const writeTargets = (targets, output) => {
  if (!output) {
    return;
  }

  const rows = targets
    .map(
      ({ group, releaseNotesFile, tag, version }) =>
        `${group}\t${version}\t${tag}\t${releaseNotesFile}`,
    )
    .join('\n');

  fs.writeFileSync(output, `${rows}\n`, 'utf8');
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
    releaseTarget(
      groupInfo,
      options.validateCurrent
        ? groupInfo.version
        : bumpVersion(groupInfo.version, options.bump),
    ),
  );

  targets.forEach(validateReleaseNotes);
  writeTargets(targets, options.output);

  if (options.validateCurrent) {
    return;
  }

  if (options.dryRun) {
    writeInfo(
      'Dry run complete. Release notes exist for the versions that would be prepared.',
    );
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
  writeInfo(
    'Release preparation complete. Review the package version changes and release notes before committing.',
  );
};

main();
