const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { it } = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const composeFile = 'servers/credentialinghub/e2e/docker-compose.yml';

it('runs the production Credentialing Hub image in E2E', () => {
  const output = execFileSync(
    'docker',
    ['compose', '--file', composeFile, 'config', '--format', 'json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const service = JSON.parse(output).services.credentialinghub;
  const dockerfile = path.isAbsolute(service.build.dockerfile)
    ? service.build.dockerfile
    : path.resolve(repoRoot, service.build.dockerfile);

  assert.equal(
    path.relative(repoRoot, dockerfile),
    'servers/credentialinghub/docker/Dockerfile',
  );
  // Compose serializes omitted fields as either absent or null by version.
  assert.ok(service.build.target == null);
  assert.ok(service.command == null);
  assert.ok(
    service.volumes.every(
      ({ target }) =>
        ![
          '/app/packages',
          '/app/servers/credentialinghub',
          '/app/servers/credentialinghub/node_modules',
        ].includes(target),
    ),
  );
  assert.ok(
    service.volumes.some(
      ({ source, target }) =>
        source.endsWith('httpscert') && target === '/certs',
    ),
  );
});
