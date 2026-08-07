#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const IMAGE_NAME = 'lfdecentralizedtrust/verii-credentialing-hub';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/* eslint-disable complexity */
const buildCredentialingHubDockerMetadata = ({
  environment,
  groups,
  publishPrerelease,
  version,
}) => {
  if (!['prerelease', 'production'].includes(environment)) {
    throw new Error(`Unsupported release environment: ${environment}`);
  }
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid Credentialing Hub version: ${version}`);
  }
  if (typeof groups !== 'string') {
    throw new Error('Release groups must be supplied');
  }

  const selectedGroups = groups
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  if (!selectedGroups.includes('credentialinghub')) {
    return { publish: false, version, tags: [] };
  }

  if (environment === 'prerelease') {
    if (!publishPrerelease) {
      return { publish: false, version, tags: [] };
    }
    if (!version.includes('-')) {
      throw new Error('Prerelease image version must contain a prerelease id');
    }
    return {
      publish: true,
      version,
      tags: [`${IMAGE_NAME}:${version}`],
    };
  }

  if (version.includes('-')) {
    throw new Error('Production image version must be stable');
  }
  return {
    publish: true,
    version,
    tags: [`${IMAGE_NAME}:${version}`, `${IMAGE_NAME}:latest`],
  };
};
/* eslint-enable complexity */

const writeGithubOutput = ({ outputFile, publish, version, tags }) => {
  if (typeof outputFile !== 'string' || outputFile.length === 0) {
    throw new Error('GITHUB_OUTPUT must be supplied');
  }
  const lines = [
    `publish=${publish}`,
    `version=${version}`,
    'tags<<DOCKER_TAGS',
    ...tags,
    'DOCKER_TAGS',
    '',
  ];
  fs.appendFileSync(outputFile, lines.join(String.fromCharCode(10)));
};

if (require.main === module) {
  const manifestPath = path.resolve(
    __dirname,
    '../../servers/credentialinghub/package.json',
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const metadata = buildCredentialingHubDockerMetadata({
    environment: process.env.RELEASE_ENVIRONMENT,
    groups: process.env.RELEASE_GROUPS,
    publishPrerelease: process.env.PUBLISH_PRERELEASE_IMAGE === 'true',
    version: manifest.version,
  });
  writeGithubOutput({
    outputFile: process.env.GITHUB_OUTPUT,
    ...metadata,
  });
}

module.exports = {
  buildCredentialingHubDockerMetadata,
  writeGithubOutput,
};
