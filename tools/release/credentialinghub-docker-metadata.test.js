const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const {
  buildCredentialingHubDockerMetadata,
} = require('./credentialinghub-docker-metadata');

const imageName = 'lfdecentralizedtrust/verii-credentialing-hub';

test('returns publication metadata for each Credentialing Hub release policy', () => {
  const cases = [
    {
      name: 'skips automatic prereleases',
      input: {
        environment: 'prerelease',
        groups: 'credentialinghub',
        publishPrerelease: false,
        version: '2.2.0-pre.123.0',
      },
      expected: { publish: false, version: '2.2.0-pre.123.0', tags: [] },
    },
    {
      name: 'publishes opted-in prereleases with the exact tag only',
      input: {
        environment: 'prerelease',
        groups: 'credentialinghub',
        publishPrerelease: true,
        version: '2.2.0-pre.123.0',
      },
      expected: {
        publish: true,
        version: '2.2.0-pre.123.0',
        tags: [`${imageName}:2.2.0-pre.123.0`],
      },
    },
    {
      name: 'skips opted-in prereleases when Hub is not selected',
      input: {
        environment: 'prerelease',
        groups: 'platform',
        publishPrerelease: true,
        version: '2.2.0-pre.123.0',
      },
      expected: { publish: false, version: '2.2.0-pre.123.0', tags: [] },
    },
    {
      name: 'publishes production images with exact and latest tags',
      input: {
        environment: 'production',
        groups: 'platform, credentialinghub',
        publishPrerelease: false,
        version: '2.2.0',
      },
      expected: {
        publish: true,
        version: '2.2.0',
        tags: [`${imageName}:2.2.0`, `${imageName}:latest`],
      },
    },
    {
      name: 'skips production images when Hub is not selected',
      input: {
        environment: 'production',
        groups: 'platform',
        publishPrerelease: false,
        version: '2.2.0',
      },
      expected: { publish: false, version: '2.2.0', tags: [] },
    },
  ];

  cases.forEach(({ name, input, expected }) => {
    assert.deepEqual(
      buildCredentialingHubDockerMetadata(input),
      expected,
      name,
    );
  });
});

test('normalizes groups without matching similarly named groups', () => {
  assert.deepEqual(
    buildCredentialingHubDockerMetadata({
      environment: 'production',
      groups: ' platform , credentialinghub , sdk-nodejs ',
      publishPrerelease: false,
      version: '2.2.0',
    }),
    {
      publish: true,
      version: '2.2.0',
      tags: [`${imageName}:2.2.0`, `${imageName}:latest`],
    },
  );
  assert.deepEqual(
    buildCredentialingHubDockerMetadata({
      environment: 'production',
      groups: 'platform,notcredentialinghub',
      publishPrerelease: false,
      version: '2.2.0',
    }),
    { publish: false, version: '2.2.0', tags: [] },
  );
});

test('rejects invalid selected Hub publication inputs', () => {
  assert.throws(
    () =>
      buildCredentialingHubDockerMetadata({
        environment: 'preview',
        groups: 'credentialinghub',
        publishPrerelease: false,
        version: '2.2.0',
      }),
    /Unsupported release environment: preview/,
  );
  assert.throws(
    () =>
      buildCredentialingHubDockerMetadata({
        environment: 'prerelease',
        groups: 'credentialinghub',
        publishPrerelease: true,
        version: '2.2.0',
      }),
    /Prerelease image version must contain a prerelease id/,
  );
  assert.throws(
    () =>
      buildCredentialingHubDockerMetadata({
        environment: 'production',
        groups: 'credentialinghub',
        publishPrerelease: false,
        version: '2.2.0-pre.123.0',
      }),
    /Production image version must be stable/,
  );
  assert.throws(
    () =>
      buildCredentialingHubDockerMetadata({
        environment: 'production',
        groups: 'credentialinghub',
        publishPrerelease: false,
        version: '2.2',
      }),
    /Invalid Credentialing Hub version: 2.2/,
  );
});

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'credentialinghub-tags-'),
);
after(() => fs.rmSync(tempDir, { force: true, recursive: true }));

test('CLI writes publish, version, and multiline tags to GITHUB_OUTPUT', () => {
  const outputFile = path.join(tempDir, 'github-output');
  const manifest = require('../../servers/credentialinghub/package.json');
  const script = path.join(__dirname, 'credentialinghub-docker-metadata.js');
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputFile,
      PUBLISH_PRERELEASE_IMAGE: 'false',
      RELEASE_ENVIRONMENT: 'production',
      RELEASE_GROUPS: 'platform, credentialinghub',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(outputFile, 'utf8'),
    [
      'publish=true',
      `version=${manifest.version}`,
      'tags<<DOCKER_TAGS',
      `${imageName}:${manifest.version}`,
      `${imageName}:latest`,
      'DOCKER_TAGS',
      '',
    ].join('\n'),
  );
});
