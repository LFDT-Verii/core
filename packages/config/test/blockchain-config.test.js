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
const { omit } = require('lodash/fp');

const packagePath = path.resolve(__dirname, '..');

// The variables genericConfig requires outside tests
const productionEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://localhost:27017/example',
  SECRET: 'example-secret',
};

const blockchainEnv = {
  RPC_NODE_URL: 'https://rpc.example.com',
  CHAIN_ID: '1234',
  COUPON_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000001',
  METADATA_REGISTRY_CONTRACT_ADDRESS:
    '0x0000000000000000000000000000000000000002',
  PERMISSIONS_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000003',
  REVOCATION_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000004',
  VNF_OAUTH_TOKENS_ENDPOINT: 'https://auth.example.com/oauth/token',
  BLOCKCHAIN_API_AUDIENCE: 'https://rpc.example.com',
};

// @verii/config reads the environment when it's first required, so load it in a fresh process.
// Resolves to the blockchain config, or to the message of the error it throws.
const loadBlockchainConfig = (env) => {
  const script = `let output;
try {
  const { createBlockchainConfig } = require(${JSON.stringify(packagePath)});
  output = { value: createBlockchainConfig() };
} catch (error) {
  output = { error: error.message };
}
process.stdout.write(JSON.stringify(output));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', script], { env, cwd: packagePath }),
  );
};

describe('createBlockchainConfig', () => {
  it('should read the network values from the environment', () => {
    expect(
      loadBlockchainConfig({
        ...productionEnv,
        ...blockchainEnv,
        VNF_OAUTH_CLIENT_ID: 'client-id',
        VNF_OAUTH_CLIENT_SECRET: 'client-secret',
      }),
    ).toEqual({
      value: {
        rpcUrl: 'https://rpc.example.com',
        chainId: 1234,
        couponContractAddress: '0x0000000000000000000000000000000000000001',
        metadataRegistryContractAddress:
          '0x0000000000000000000000000000000000000002',
        permissionsContractAddress:
          '0x0000000000000000000000000000000000000003',
        revocationContractAddress: '0x0000000000000000000000000000000000000004',
        vnfOAuthTokensEndpoint: 'https://auth.example.com/oauth/token',
        vnfClientId: 'client-id',
        vnfClientSecret: 'client-secret',
        blockchainApiAudience: 'https://rpc.example.com',
      },
    });
  });

  it("should leave the client credentials unset when the environment doesn't set them", () => {
    const { value } = loadBlockchainConfig({
      ...productionEnv,
      ...blockchainEnv,
    });
    expect(value).not.toHaveProperty('vnfClientId');
    expect(value).not.toHaveProperty('vnfClientSecret');
  });

  for (const name of Object.keys(blockchainEnv)) {
    it(`should require ${name} outside tests`, () => {
      expect(
        loadBlockchainConfig({
          ...productionEnv,
          ...omit([name], blockchainEnv),
        }).error,
      ).toContain(`"${name}" is a required variable`);
    });
  }

  it('should require no network value in tests', () => {
    expect(
      loadBlockchainConfig({ PATH: process.env.PATH, NODE_ENV: 'test' }).error,
    ).toBeUndefined();
  });
});
