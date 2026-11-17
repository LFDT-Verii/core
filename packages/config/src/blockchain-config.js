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

const env = require('env-var');
const { isTest } = require('./config');

/**
 * Config for servers that use the blockchain: the node, its chain, the contracts, and the
 * OAuth client the node authenticates. The server's operator sets all of these. The client
 * ID and secret aren't required here: the blockchain client checks for them when a server
 * starts, unless the server resolves client credentials another way.
 * @returns {Object} the blockchain config, to spread into a server's config
 */
const createBlockchainConfig = () => ({
  rpcUrl: env.get('RPC_NODE_URL').required(!isTest).asString(),
  chainId: env.get('CHAIN_ID').required(!isTest).asInt(),
  couponContractAddress: env
    .get('COUPON_CONTRACT_ADDRESS')
    .required(!isTest)
    .asString(),
  metadataRegistryContractAddress: env
    .get('METADATA_REGISTRY_CONTRACT_ADDRESS')
    .required(!isTest)
    .asString(),
  permissionsContractAddress: env
    .get('PERMISSIONS_CONTRACT_ADDRESS')
    .required(!isTest)
    .asString(),
  revocationContractAddress: env
    .get('REVOCATION_CONTRACT_ADDRESS')
    .required(!isTest)
    .asString(),
  vnfOAuthTokensEndpoint: env
    .get('VNF_OAUTH_TOKENS_ENDPOINT')
    .required(!isTest)
    .asString(),
  vnfClientId: env.get('VNF_OAUTH_CLIENT_ID').asString(),
  vnfClientSecret: env.get('VNF_OAUTH_CLIENT_SECRET').asString(),
  blockchainApiAudience: env
    .get('BLOCKCHAIN_API_AUDIENCE')
    .required(!isTest)
    .asString(),
});

module.exports = { createBlockchainConfig };
