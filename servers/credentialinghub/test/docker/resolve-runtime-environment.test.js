const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  GENERIC_OAUTH_ALIASES,
  resolveRuntimeEnvironment,
} = require('../../docker/resolve-runtime-environment');

const unsupportedArgumentMessage =
  'Unsupported Credentialing Hub image argument. The image takes no arguments: ' +
  'it no longer presets a network. Set the network values as environment variables. ' +
  'See https://github.com/LFDT-Verii/core/blob/main/servers/credentialinghub/README.md#network-settings';

describe('resolveRuntimeEnvironment', () => {
  it('passes the environment through without mutating it', () => {
    const env = {
      MONGO_URI: 'mongodb://mongo/hub',
      OPERATOR_TOKEN: 'operator-secret',
      RPC_NODE_URL: 'https://rpc.example.com',
      CHAIN_ID: '1234',
    };
    const original = { ...env };

    const result = resolveRuntimeEnvironment({ args: [], env });

    assert.deepEqual(env, original);
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

  // The image's former network flags, and anything else
  for (const arg of [
    '--mainnet',
    '--testnet',
    '--devnet',
    '--no-preset',
    '--velocity-mainnet',
    '--velocity-testnet',
    '--velocity-devnet',
    '--custom-network',
    'run',
    '',
  ]) {
    it(`rejects the image argument ${JSON.stringify(arg)}`, () => {
      assert.throws(() => resolveRuntimeEnvironment({ args: [arg] }), {
        message: unsupportedArgumentMessage,
      });
    });
  }
});
