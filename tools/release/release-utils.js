/* eslint-disable better-mutation/no-mutating-methods */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));

const requireOptionValue = (argv, index, arg) => {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }

  return value;
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
    throw new Error(`Unsupported release project spec: ${spec}`);
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

const assertFixedReleaseGroup = (group, groupConfig) => {
  if (groupConfig.projectsRelationship !== 'fixed') {
    throw new Error(
      `Release group ${group} must use projectsRelationship "fixed".`,
    );
  }
};

const releaseTag = (group, groupConfig, version) =>
  (groupConfig.releaseTag?.pattern ?? `${group}-v{version}`).replace(
    '{version}',
    version,
  );

const releaseGroupInfo = (group, groupConfig) => {
  assertFixedReleaseGroup(group, groupConfig);

  const roots = projectRootsForGroup(groupConfig);

  if (roots.length === 0) {
    throw new Error(
      `Release group ${group} does not include any package manifests.`,
    );
  }

  const manifests = roots.map((root) => ({
    root,
    manifest: readJson(path.join(root, 'package.json')),
  }));
  const versions = [
    ...new Set(manifests.map(({ manifest }) => manifest.version)),
  ];

  if (versions.length !== 1) {
    throw new Error(
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

module.exports = {
  assertFixedReleaseGroup,
  projectRootsForGroup,
  readJson,
  releaseGroupInfo,
  releaseTag,
  repoRoot,
  requireOptionValue,
};
