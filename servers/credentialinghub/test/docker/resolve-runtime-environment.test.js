const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  GENERIC_OAUTH_ALIASES,
  resolveRuntimeEnvironment,
} = require('../../docker/resolve-runtime-environment');
const {
  VELOCITY_NETWORK_PRESETS,
} = require('../../docker/velocity-network-presets');

describe('resolveRuntimeEnvironment', () => {
  for (const [shortcut, preset] of Object.entries(VELOCITY_NETWORK_PRESETS)) {
    it(`applies ${shortcut} without mutating the environment`, () => {
      const env = {
        MONGO_URI: 'mongodb://mongo/hub',
        VNF_OAUTH_CLIENT_ID: 'client-id',
        VNF_OAUTH_CLIENT_SECRET: 'client-secret',
      };
      const original = { ...env };
      const result = resolveRuntimeEnvironment({ args: [shortcut], env });

      assert.deepEqual(env, original);
      assert.deepEqual(result, { ...env, ...preset });
    });
  }

  it('preserves unrelated operational and secret values', () => {
    const env = {
      MONGO_URI: 'mongodb://mongo/hub',
      OPERATOR_TOKEN: 'operator-secret',
    };

    const result = resolveRuntimeEnvironment({ args: [], env });

    assert.deepEqual(result, env);
    assert.notEqual(result, env);
  });

  it('maps generic OAuth settings', () => {
    const env = Object.fromEntries(
      Object.keys(GENERIC_OAUTH_ALIASES).map((name) => [name, `${name}-value`]),
    );
    const result = resolveRuntimeEnvironment({ args: [], env });

    for (const [genericName, hubName] of Object.entries(
      GENERIC_OAUTH_ALIASES,
    )) {
      assert.equal(result[hubName], `${genericName}-value`);
    }
  });

  it('accepts generic OAuth client credentials with a network shortcut', () => {
    const result = resolveRuntimeEnvironment({
      args: ['--velocity-devnet'],
      env: {
        BLOCKCHAIN_OAUTH_CLIENT_ID: 'client-id',
        BLOCKCHAIN_OAUTH_CLIENT_SECRET: 'client-secret',
      },
    });

    assert.equal(result.VNF_OAUTH_CLIENT_ID, 'client-id');
    assert.equal(result.VNF_OAUTH_CLIENT_SECRET, 'client-secret');
  });

  for (const [genericName, hubName] of Object.entries(GENERIC_OAUTH_ALIASES)) {
    it(`rejects ${genericName} together with ${hubName}`, () => {
      assert.throws(
        () =>
          resolveRuntimeEnvironment({
            env: { [genericName]: 'generic', [hubName]: 'hub' },
          }),
        new RegExp(`${genericName} and ${hubName}`),
      );
    });
  }

  it('rejects a shortcut with an owned Hub setting', () => {
    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--velocity-testnet'],
          env: { RPC_NODE_URL: 'https://custom.example' },
        }),
      /--velocity-testnet cannot be combined with: RPC_NODE_URL/,
    );
  });

  for (const genericName of [
    'BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT',
    'BLOCKCHAIN_OAUTH_AUDIENCE',
  ]) {
    it(`rejects a shortcut with ${genericName}`, () => {
      assert.throws(
        () =>
          resolveRuntimeEnvironment({
            args: ['--velocity-mainnet'],
            env: { [genericName]: 'configured' },
          }),
        new RegExp(genericName),
      );
    });
  }

  it('treats an explicitly empty owned setting as a shortcut conflict', () => {
    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--velocity-devnet'],
          env: { RPC_NODE_URL: '' },
        }),
      /RPC_NODE_URL/,
    );
  });

  it('rejects multiple network shortcuts', () => {
    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--velocity-devnet', '--velocity-testnet'],
        }),
      /Only one Velocity network shortcut may be supplied/,
    );
  });

  it('rejects unknown image arguments', () => {
    assert.throws(
      () => resolveRuntimeEnvironment({ args: ['--custom-network'] }),
      /Unsupported Credentialing Hub image argument/,
    );
  });

  it('rejects malformed image arguments', () => {
    assert.throws(
      () => resolveRuntimeEnvironment({ args: [''] }),
      /Unsupported Credentialing Hub image argument/,
    );
  });

  it('rejects positional image arguments', () => {
    assert.throws(
      () => resolveRuntimeEnvironment({ args: ['run'] }),
      /Unsupported Credentialing Hub image argument/,
    );
  });

  it('names conflicting variables without exposing their values', () => {
    const sentinel = 'do-not-print-this-value';

    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--velocity-devnet'],
          env: { RPC_NODE_URL: sentinel },
        }),
      (error) =>
        error.message.includes('RPC_NODE_URL') &&
        !error.message.includes(sentinel),
    );
  });
});
