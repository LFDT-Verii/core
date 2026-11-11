const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  GENERIC_OAUTH_ALIASES,
  NETWORK_FLAGS,
  resolveRuntimeEnvironment,
} = require('../../docker/resolve-runtime-environment');

describe('resolveRuntimeEnvironment', () => {
  for (const [flag, network] of Object.entries(NETWORK_FLAGS)) {
    it(`selects ${network} with ${flag} without mutating the environment`, () => {
      const env = {
        MONGO_URI: 'mongodb://mongo/hub',
        VNF_OAUTH_CLIENT_ID: 'client-id',
        VNF_OAUTH_CLIENT_SECRET: 'client-secret',
      };
      const original = { ...env };
      const result = resolveRuntimeEnvironment({ args: [flag], env });

      assert.deepEqual(env, original);
      assert.deepEqual(result, { ...env, NETWORK: network });
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

  it('leaves NETWORK to the environment without a flag', () => {
    const result = resolveRuntimeEnvironment({
      args: [],
      env: { NETWORK: 'testnet' },
    });

    assert.equal(result.NETWORK, 'testnet');
  });

  it('passes network values through with a flag, for @verii/config to check', () => {
    const result = resolveRuntimeEnvironment({
      args: ['--testnet'],
      env: { RPC_NODE_URL: 'https://custom.example', CHAIN_ID: '2020' },
    });

    assert.deepEqual(result, {
      RPC_NODE_URL: 'https://custom.example',
      CHAIN_ID: '2020',
      NETWORK: 'testnet',
    });
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

  it('accepts generic OAuth client credentials with a network flag', () => {
    const result = resolveRuntimeEnvironment({
      args: ['--devnet'],
      env: {
        BLOCKCHAIN_OAUTH_CLIENT_ID: 'client-id',
        BLOCKCHAIN_OAUTH_CLIENT_SECRET: 'client-secret',
      },
    });

    assert.equal(result.VNF_OAUTH_CLIENT_ID, 'client-id');
    assert.equal(result.VNF_OAUTH_CLIENT_SECRET, 'client-secret');
    assert.equal(result.NETWORK, 'devnet');
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

  it('accepts NETWORK when it matches the flag', () => {
    const result = resolveRuntimeEnvironment({
      args: ['--velocity-testnet'],
      env: { NETWORK: 'testnet' },
    });

    assert.equal(result.NETWORK, 'testnet');
  });

  it('rejects a flag that disagrees with NETWORK', () => {
    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--mainnet'],
          env: { NETWORK: 'devnet' },
        }),
      /--mainnet can't be combined with NETWORK=devnet/,
    );
  });

  it('rejects multiple network flags', () => {
    assert.throws(
      () =>
        resolveRuntimeEnvironment({
          args: ['--devnet', '--testnet'],
        }),
      /Only one network flag may be supplied/,
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
});
