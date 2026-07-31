const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { it } = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');

const readJson = (root, relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const copyTrackedWorkspace = (destination) => {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'buffer',
  });

  assert.equal(result.status, 0, result.stderr.toString());

  result.stdout
    .toString()
    .split('\0')
    .filter(Boolean)
    .forEach((relativePath) => {
      const source = path.join(repoRoot, relativePath);
      const target = path.join(destination, relativePath);

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    });

  fs.symlinkSync(
    path.join(repoRoot, 'node_modules'),
    path.join(destination, 'node_modules'),
    'dir',
  );
};

it(
  'prepares selected groups without versioning filtered-out dependents',
  { timeout: 30000 },
  () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'verii-release-prepare-'),
    );

    try {
      copyTrackedWorkspace(fixtureRoot);

      const result = spawnSync(
        'node',
        [
          'tools/release/prepare-release.js',
          '--groups',
          'platform,credentialagent,credentialinghub',
          '--bump',
          'minor',
          '--message',
          'Test selected release groups',
        ],
        {
          cwd: fixtureRoot,
          encoding: 'utf8',
        },
      );

      assert.equal(
        result.status,
        0,
        `${result.stdout}\n${result.stderr}`.trim(),
      );
      assert.equal(
        readJson(fixtureRoot, 'packages/auth/package.json').version,
        '1.2.0',
      );
      assert.equal(
        readJson(fixtureRoot, 'servers/credentialagent/package.json').version,
        '1.28.0',
      );
      assert.equal(
        readJson(fixtureRoot, 'servers/credentialinghub/package.json').version,
        '2.1.0',
      );
      assert.equal(
        readJson(fixtureRoot, 'packages/vnf-wallet-sdk-nodejs/package.json')
          .version,
        '2.10.0',
      );
      assert.deepEqual(readJson(fixtureRoot, '.github/release.json'), {
        kind: 'verii-release',
        bump: 'minor',
        groups: {
          platform: '1.2.0',
          credentialagent: '1.28.0',
          credentialinghub: '2.1.0',
        },
      });
      assert.deepEqual(
        fs
          .readdirSync(path.join(fixtureRoot, '.nx/version-plans'))
          .filter((file) => file.endsWith('.md')),
        [],
      );
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  },
);
