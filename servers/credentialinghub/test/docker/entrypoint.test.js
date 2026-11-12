const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { describe, it } = require('node:test');

const entrypointPath = path.resolve(__dirname, '../../docker/entrypoint.js');

describe('Credentialing Hub Docker entrypoint', () => {
  it('lets application startup failures retain their stack and default exit code', () => {
    const startupFailureScript = `
      const Module = require('node:module');
      const originalLoad = Module._load;
      Module._load = (request, parent, isMain) => {
        if (request === '../src/main') {
          throw new Error('sentinel application startup failure');
        }
        return Reflect.apply(originalLoad, Module, [request, parent, isMain]);
      };
      require(${JSON.stringify(entrypointPath)});
    `;
    const result = spawnSync(process.execPath, ['-e', startupFailureScript], {
      encoding: 'utf8',
      env: {},
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: sentinel application startup failure/);
    assert.doesNotMatch(
      result.stderr,
      /Credentialing Hub startup configuration error/,
    );
  });

  it('reports invalid image arguments as configuration errors', () => {
    const result = spawnSync(
      process.execPath,
      [entrypointPath, '--unsupported-network'],
      { encoding: 'utf8', env: {} },
    );

    assert.equal(result.status, 64);
    assert.match(
      result.stderr,
      /Credentialing Hub startup configuration error: Unsupported Credentialing Hub image argument/,
    );
  });
});
