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

const { isEmpty } = require('lodash/fp');

const Networks = Object.freeze({
  DEVNET: 'devnet',
  TESTNET: 'testnet',
  MAINNET: 'mainnet',
  // A network that isn't one of Velocity's: no preset, so every network value must be set
  NO_PRESET: 'no-preset',
});

// How a server connects to its network. These may differ from the preset on every network,
// mainnet included. The OAuth client ID and secret are never preset.
const CONNECTION_SETTINGS = Object.freeze([
  'RPC_NODE_URL',
  'VNF_OAUTH_TOKENS_ENDPOINT',
]);

// Public values only: the server images that carry these are public
const NETWORK_PRESETS = Object.freeze({
  [Networks.DEVNET]: Object.freeze({
    RPC_NODE_URL: 'https://devmember.velocitycareerlabs.io',
    CHAIN_ID: '1480',
    REVOCATION_CONTRACT_ADDRESS: '0xD890F2D60B429f9e257FC0Bc58Ef2237776DD91B',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0x800B4740470C85035015a7B38DedB0f4bB82c985',
    COUPON_CONTRACT_ADDRESS: '0xD08600fbE01fA09490d387974CC915aD7f254A91',
    PERMISSIONS_CONTRACT_ADDRESS: '0x823e6B949D4972230cc9637FE83EdB080e0D72dd',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://devauth.velocitynetwork.foundation/oauth/token',
    VNF_OAUTH_AUTHORIZATION_ENDPOINT:
      'https://devauth.velocitynetwork.foundation/authorize',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    REGISTRAR_URL: 'https://devregistrar.velocitynetwork.foundation',
    LIB_URL: 'https://devlib.velocitynetwork.foundation',
    MEDIA_URL: 'https://devmedia.velocitynetwork.foundation',
    DEEP_LINK_PROTOCOL: 'velocity-network-devnet://',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://devlib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
    VNF_DID: 'did:ion:EiCoJtiS6RsIcYsHskgChOdlfNa0RrUG5qGeF3PpMX8nXA',
    VNF_HEADER_SIGNATURE_VERIFICATION_KEY:
      '04df8e36afbcedfb33b86f136bfeb6ea440c6343d7ba9d02bfb23fe63b33617c6ab46dfdc1047012767e70ff5cc640bee268f2e874e128f5772cc882ba67404af9',
  }),
  [Networks.TESTNET]: Object.freeze({
    RPC_NODE_URL: 'https://stagingmember.velocitycareerlabs.io',
    CHAIN_ID: '1481',
    REVOCATION_CONTRACT_ADDRESS: '0x1C29461C7480d1d8570df7c0A4F314D0bE8cD5Bf',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0x1550b4f24368c8Eb839073ac04673777D9dda60A',
    COUPON_CONTRACT_ADDRESS: '0xC172E0F7aed123Cd23c2fE0b33020f9e96B0c4Be',
    PERMISSIONS_CONTRACT_ADDRESS: '0xDC088C3D1dC820De88A1b0DCCB25bA6B6f4A74ba',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://stagingauth.velocitynetwork.foundation/oauth/token',
    VNF_OAUTH_AUTHORIZATION_ENDPOINT:
      'https://stagingauth.velocitynetwork.foundation/authorize',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    REGISTRAR_URL: 'https://stagingregistrar.velocitynetwork.foundation',
    LIB_URL: 'https://staginglib.velocitynetwork.foundation',
    MEDIA_URL: 'https://stagingmedia.velocitynetwork.foundation',
    DEEP_LINK_PROTOCOL: 'velocity-network-testnet://',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://staginglib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
    VNF_DID: 'did:ion:EiDk-Cci8B4AQoO5fJc8twjpD1aAZPnOQo0OE5bPY2gZlQ',
    VNF_HEADER_SIGNATURE_VERIFICATION_KEY:
      '04ee91645a8ee95e09597eefbb71641e77813a4ee9e9d26a89ce6dd601ef5280f66694dfe26f55bafe672c401a2f42681206b2cbb36cd4d4f52b0b83f52f80162b',
  }),
  [Networks.MAINNET]: Object.freeze({
    RPC_NODE_URL: 'https://member.velocitycareerlabs.io',
    CHAIN_ID: '1482',
    REVOCATION_CONTRACT_ADDRESS: '0x8264cCaEa3Cacf851e6DEd77999dDB6cde6977DB',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0xE3AA014F2c6796ca9Da615893433D933A6A2D1c9',
    COUPON_CONTRACT_ADDRESS: '0xAE1d4258c60843a03875550C1e5E71BD8248BF84',
    PERMISSIONS_CONTRACT_ADDRESS: '0x94710f19BB98bd444F984BBD8624aF2b3F9471eE',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://auth.velocitynetwork.foundation/oauth/token',
    VNF_OAUTH_AUTHORIZATION_ENDPOINT:
      'https://auth.velocitynetwork.foundation/authorize',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    REGISTRAR_URL: 'https://registrar.velocitynetwork.foundation',
    LIB_URL: 'https://lib.velocitynetwork.foundation',
    MEDIA_URL: 'https://media.velocitynetwork.foundation',
    DEEP_LINK_PROTOCOL: 'velocity-network://',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
    VNF_DID: 'did:ion:EiCJ0oiRRZBwD43BKRGFEXtyNhzflOSNZqG0CGUI2OZb4g',
    VNF_HEADER_SIGNATURE_VERIFICATION_KEY:
      '04998d8f2ce744129803925e117d499e58e78c162bf457a34ff1a4988143ffee69e2d032b1d62538c7adc6eeff30ba5eba138ce774571c1dacf67936a16d9c19cb',
  }),
});

const getNetworkPreset = (network) => NETWORK_PRESETS[network] ?? {};

// Contract addresses are hex, so their case doesn't matter
const isSameValue = (name, value, presetValue) =>
  name.endsWith('_CONTRACT_ADDRESS')
    ? value.toLowerCase() === presetValue.toLowerCase()
    : value === presetValue;

/**
 * Lists the preset variables that the environment sets to something other than the preset.
 * @param {string} network the selected network
 * @param {Object<string, string>} environment the environment, such as `process.env`
 * @returns {string[]} the names of the overridden variables
 */
const findNetworkOverrides = (network, environment) =>
  Object.entries(getNetworkPreset(network))
    .filter(
      ([name, presetValue]) =>
        !isEmpty(environment[name]) &&
        !isSameValue(name, environment[name], presetValue),
    )
    .map(([name]) => name);

/**
 * Throws when the environment overrides a mainnet value other than a connection setting.
 * The message names the variables but never their values.
 * @param {string} network the selected network
 * @param {string[]} overrides the names of the overridden variables
 * @returns {void}
 */
const assertNetworkOverridesAllowed = (network, overrides) => {
  if (network !== Networks.MAINNET) {
    return;
  }
  const locked = overrides.filter(
    (name) => !CONNECTION_SETTINGS.includes(name),
  );
  if (!isEmpty(locked)) {
    throw new Error(
      `${locked.join(', ')} can't be changed on mainnet. ` +
        'For devnet or testnet, set NETWORK to that network. ' +
        'To set your own network values, set NETWORK=no-preset (--no-preset).',
    );
  }
};

/**
 * Builds the environment the network presets apply to: each preset variable that isn't set,
 * or is set empty, takes the preset's value.
 * @param {string} network the selected network
 * @param {Object<string, string>} environment the environment, such as `process.env`
 * @returns {Object<string, string>} the environment with the preset applied
 */
const applyNetworkPreset = (network, environment) => ({
  ...environment,
  ...Object.fromEntries(
    Object.entries(getNetworkPreset(network)).filter(([name]) =>
      isEmpty(environment[name]),
    ),
  ),
});

module.exports = {
  Networks,
  CONNECTION_SETTINGS,
  NETWORK_PRESETS,
  applyNetworkPreset,
  assertNetworkOverridesAllowed,
  findNetworkOverrides,
};
