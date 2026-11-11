/**
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { describe, it } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { expect } = require('expect');
const {
  NETWORK_PRESETS,
  Networks,
  applyNetworkPreset,
  assertNetworkOverridesAllowed,
  findNetworkOverrides,
} = require('../src/networks');

const packagePath = path.resolve(__dirname, '..');
const mainnet = NETWORK_PRESETS[Networks.MAINNET];

// The variables @verii/config requires outside tests
const productionEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://localhost:27017/example',
  SECRET: 'example-secret',
};

// @verii/config reads the environment when it's first required, so load it in a fresh process.
// Resolves to the value of `expression`, or to the message of the error it throws.
const evaluate = (env, expression) => {
  const script = `let output;
try {
  const config = require(${JSON.stringify(packagePath)});
  output = { value: (${expression})(config) };
} catch (error) {
  output = { error: error.message };
}
process.stdout.write(JSON.stringify(output));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', script], { env, cwd: packagePath }),
  );
};

describe('network presets', () => {
  it('should give each Velocity network the same variables', () => {
    const presetNames = Object.values(NETWORK_PRESETS).map((preset) =>
      Object.keys(preset).sort(),
    );
    expect(presetNames).toEqual([
      presetNames[0],
      presetNames[0],
      presetNames[0],
    ]);
    expect(Object.keys(NETWORK_PRESETS).sort()).toEqual([
      'devnet',
      'mainnet',
      'testnet',
    ]);
  });

  it('should list the variables set to something other than the preset', () => {
    expect(
      findNetworkOverrides(Networks.MAINNET, {
        CHAIN_ID: '1480',
        RPC_NODE_URL: 'https://rpc.example.com',
        LIB_URL: mainnet.LIB_URL,
        COUPON_CONTRACT_ADDRESS: mainnet.COUPON_CONTRACT_ADDRESS.toLowerCase(),
        REGISTRAR_URL: '',
        SECRET: 'not-a-preset-variable',
      }),
    ).toEqual(['RPC_NODE_URL', 'CHAIN_ID']);
  });

  it('should find no overrides without a preset', () => {
    expect(
      findNetworkOverrides(Networks.NO_PRESET, { CHAIN_ID: '2020' }),
    ).toEqual([]);
  });

  it('should allow only the connection settings to change on mainnet', () => {
    expect(() =>
      assertNetworkOverridesAllowed(Networks.MAINNET, [
        'RPC_NODE_URL',
        'VNF_OAUTH_TOKENS_ENDPOINT',
      ]),
    ).not.toThrow();
    expect(() =>
      assertNetworkOverridesAllowed(Networks.MAINNET, [
        'RPC_NODE_URL',
        'CHAIN_ID',
        'BLOCKCHAIN_API_AUDIENCE',
      ]),
    ).toThrow(
      "CHAIN_ID, BLOCKCHAIN_API_AUDIENCE can't be changed on mainnet. " +
        'For devnet or testnet, set NETWORK to that network. ' +
        'To set your own network values, set NETWORK=no-preset (--no-preset).',
    );
  });

  it('should allow any override on devnet and testnet', () => {
    expect(() =>
      assertNetworkOverridesAllowed(Networks.DEVNET, ['CHAIN_ID']),
    ).not.toThrow();
    expect(() =>
      assertNetworkOverridesAllowed(Networks.TESTNET, ['CHAIN_ID']),
    ).not.toThrow();
  });

  it('should fill the preset variables that are unset or empty', () => {
    const environment = applyNetworkPreset(Networks.TESTNET, {
      LIB_URL: 'https://lib.example.com',
      REGISTRAR_URL: '',
      SECRET: 'secret',
    });
    expect(environment).toEqual({
      ...NETWORK_PRESETS[Networks.TESTNET],
      LIB_URL: 'https://lib.example.com',
      SECRET: 'secret',
    });
  });

  it('should leave the environment as it is without a preset', () => {
    expect(applyNetworkPreset(Networks.NO_PRESET, { LIB_URL: '' })).toEqual({
      LIB_URL: '',
    });
  });
});

describe('NETWORK', () => {
  const readNetwork = ({ network, isMainnet, networkOverrides }) => ({
    network,
    isMainnet,
    networkOverrides,
  });

  it('should default to mainnet outside tests', () => {
    expect(
      evaluate(
        productionEnv,
        `({ genericConfig }) => (${readNetwork})(genericConfig)`,
      ),
    ).toEqual({
      value: { network: 'mainnet', isMainnet: true, networkOverrides: [] },
    });
  });

  it('should default to no preset in tests', () => {
    expect(
      evaluate(
        { PATH: process.env.PATH, NODE_ENV: 'test' },
        `({ genericConfig }) => (${readNetwork})(genericConfig)`,
      ),
    ).toEqual({
      value: { network: 'no-preset', isMainnet: false, networkOverrides: [] },
    });
  });

  it('should reject an unknown network', () => {
    expect(
      evaluate({ ...productionEnv, NETWORK: 'qanet' }, '() => null').error,
    ).toContain(
      '"NETWORK" should be one of [devnet, testnet, mainnet, no-preset]',
    );
  });

  it('should refuse to load when a mainnet value other than a connection setting is changed', () => {
    const result = evaluate(
      {
        ...productionEnv,
        CHAIN_ID: '424242',
        LIB_URL: 'https://lib.example.com',
      },
      '() => null',
    );
    expect(result.error).toMatch(
      /^CHAIN_ID, LIB_URL can't be changed on mainnet/,
    );
    expect(result.error).not.toContain('424242');
  });

  it('should list the connection settings changed on mainnet', () => {
    expect(
      evaluate(
        {
          ...productionEnv,
          NETWORK: 'mainnet',
          RPC_NODE_URL: 'https://rpc.example.com',
          VNF_OAUTH_TOKENS_ENDPOINT: 'https://auth.example.com/oauth/token',
          CHAIN_ID: mainnet.CHAIN_ID,
        },
        `({ genericConfig }) => (${readNetwork})(genericConfig)`,
      ),
    ).toEqual({
      value: {
        network: 'mainnet',
        isMainnet: true,
        networkOverrides: ['RPC_NODE_URL', 'VNF_OAUTH_TOKENS_ENDPOINT'],
      },
    });
  });

  it('should list any value changed on testnet', () => {
    expect(
      evaluate(
        { ...productionEnv, NETWORK: 'testnet', CHAIN_ID: '2020' },
        `({ genericConfig }) => (${readNetwork})(genericConfig)`,
      ),
    ).toEqual({
      value: {
        network: 'testnet',
        isMainnet: false,
        networkOverrides: ['CHAIN_ID'],
      },
    });
  });
});

describe('networkEnv', () => {
  const readLibUrl =
    '({ networkEnv }) => networkEnv().get("LIB_URL").asString() ?? null';

  it('should read the preset value of an unset variable', () => {
    expect(
      evaluate({ ...productionEnv, NETWORK: 'devnet' }, readLibUrl),
    ).toEqual({
      value: NETWORK_PRESETS[Networks.DEVNET].LIB_URL,
    });
  });

  it('should read the set value of a variable over the preset', () => {
    expect(
      evaluate(
        {
          ...productionEnv,
          NETWORK: 'devnet',
          LIB_URL: 'https://lib.example.com',
        },
        readLibUrl,
      ),
    ).toEqual({ value: 'https://lib.example.com' });
  });

  it('should read only the environment with no preset', () => {
    expect(
      evaluate({ ...productionEnv, NETWORK: 'no-preset' }, readLibUrl),
    ).toEqual({ value: null });
  });

  it('should take extra accessors', () => {
    expect(
      evaluate(
        { ...productionEnv, NETWORK: 'testnet' },
        '({ networkEnv }) => networkEnv({ asShout: (value) => value.toUpperCase() }).get("DEEP_LINK_PROTOCOL").asShout()',
      ),
    ).toEqual({ value: 'VELOCITY-NETWORK-TESTNET://' });
  });
});

describe('createBlockchainConfig', () => {
  it('should take every value but the client credentials from the preset', () => {
    expect(
      evaluate(
        {
          ...productionEnv,
          NETWORK: 'testnet',
          VNF_OAUTH_CLIENT_ID: 'client-id',
          VNF_OAUTH_CLIENT_SECRET: 'client-secret',
        },
        '({ createBlockchainConfig }) => createBlockchainConfig()',
      ),
    ).toEqual({
      value: {
        rpcUrl: 'https://stagingmember.velocitycareerlabs.io',
        chainId: 1481,
        couponContractAddress: '0xC172E0F7aed123Cd23c2fE0b33020f9e96B0c4Be',
        metadataRegistryContractAddress:
          '0x1550b4f24368c8Eb839073ac04673777D9dda60A',
        permissionsContractAddress:
          '0xDC088C3D1dC820De88A1b0DCCB25bA6B6f4A74ba',
        revocationContractAddress: '0x1C29461C7480d1d8570df7c0A4F314D0bE8cD5Bf',
        vnfOAuthTokensEndpoint:
          'https://stagingauth.velocitynetwork.foundation/oauth/token',
        vnfClientId: 'client-id',
        vnfClientSecret: 'client-secret',
        blockchainApiAudience: 'https://velocitynetwork.node',
      },
    });
  });

  it('should take the RPC node from the environment on mainnet', () => {
    expect(
      evaluate(
        { ...productionEnv, RPC_NODE_URL: 'https://rpc.example.com' },
        '({ createBlockchainConfig }) => createBlockchainConfig().rpcUrl',
      ),
    ).toEqual({ value: 'https://rpc.example.com' });
  });

  it("should leave the client credentials unset when the environment doesn't set them", () => {
    expect(
      evaluate(
        productionEnv,
        '({ createBlockchainConfig }) => [createBlockchainConfig().vnfClientId ?? null, createBlockchainConfig().vnfClientSecret ?? null]',
      ),
    ).toEqual({ value: [null, null] });
  });

  it('should require the network values with no preset', () => {
    expect(
      evaluate(
        {
          ...productionEnv,
          NETWORK: 'no-preset',
          RPC_NODE_URL: 'https://rpc.example.com',
        },
        '({ createBlockchainConfig }) => createBlockchainConfig()',
      ).error,
    ).toContain('"CHAIN_ID" is a required variable');
  });
});
