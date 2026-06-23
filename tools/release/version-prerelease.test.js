const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  bumpVersion,
  normalizeGroups,
  prereleaseBump,
  releaseTrainEntry,
  validateReleaseTrain,
  validateSelectedGroups,
  versionPlanContent,
} = require('./version-prerelease');

describe('version-prerelease', () => {
  it('maps stable release train bumps to prerelease bumps', () => {
    assert.equal(prereleaseBump('major'), 'premajor');
    assert.equal(prereleaseBump('minor'), 'preminor');
    assert.equal(prereleaseBump('patch'), 'prepatch');
  });

  it('computes target versions from stable bumps', () => {
    assert.equal(bumpVersion('1.1.3', 'minor'), '1.2.0');
    assert.equal(bumpVersion('1.27.0', 'major'), '2.0.0');
    assert.equal(bumpVersion('2.0.0', 'patch'), '2.0.1');
  });

  it('rejects release trains that do not cover every release group', () => {
    assert.throws(
      () =>
        validateReleaseTrain(
          {
            kind: 'verii-release-train',
            groups: { platform: { bump: 'minor', targetVersion: '1.2.0' } },
          },
          {
            platform: {},
            credentialagent: {},
          },
        ),
      /missing release group\(s\): credentialagent/,
    );
  });

  it('validates target version against the configured bump', () => {
    assert.deepEqual(
      releaseTrainEntry(
        {
          groups: {
            credentialinghub: { bump: 'patch', targetVersion: '2.0.1' },
          },
        },
        'credentialinghub',
        { version: '2.0.0' },
      ),
      {
        bump: 'patch',
        prereleaseBump: 'prepatch',
        targetVersion: '2.0.1',
      },
    );

    assert.throws(
      () =>
        releaseTrainEntry(
          {
            groups: {
              credentialinghub: { bump: 'minor', targetVersion: '2.0.1' },
            },
          },
          'credentialinghub',
          { version: '2.0.0' },
        ),
      /targetVersion must be 2\.1\.0/,
    );
  });

  it('normalizes requested groups and rejects unknown groups', () => {
    assert.deepEqual(
      normalizeGroups(' platform, credentialinghub ', {
        platform: {},
        credentialinghub: {},
      }),
      ['platform', 'credentialinghub'],
    );

    assert.throws(
      () => normalizeGroups('unknown', { platform: {} }),
      /Unknown release group\(s\): unknown/,
    );
  });

  it('requires all release groups when the platform train is selected', () => {
    const releaseGroups = {
      platform: {},
      credentialagent: {},
      credentialinghub: {},
      'sdk-nodejs': {},
    };

    assert.doesNotThrow(() =>
      validateSelectedGroups(
        ['platform', 'credentialagent', 'credentialinghub', 'sdk-nodejs'],
        releaseGroups,
      ),
    );

    assert.throws(
      () => validateSelectedGroups(['platform'], releaseGroups),
      /select all release groups/,
    );
  });

  it('renders a temporary Nx version plan from train targets', () => {
    assert.equal(
      versionPlanContent([
        {
          group: 'platform',
          prereleaseBump: 'preminor',
          targetVersion: '1.2.0',
        },
        {
          group: 'credentialinghub',
          prereleaseBump: 'prepatch',
          targetVersion: '2.0.1',
        },
      ]),
      `---
platform: preminor
credentialinghub: prepatch
---

Prepare prerelease train:

- platform 1.2.0
- credentialinghub 2.0.1
`,
    );
  });
});
