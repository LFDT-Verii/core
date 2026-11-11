const VELOCITY_NETWORK_PRESETS = Object.freeze({
  '--velocity-devnet': Object.freeze({
    RPC_NODE_URL: 'https://devmember.velocitycareerlabs.io',
    CHAIN_ID: '1480',
    REGISTRAR_URL: 'https://devregistrar.velocitynetwork.foundation',
    REVOCATION_CONTRACT_ADDRESS: '0xD890F2D60B429f9e257FC0Bc58Ef2237776DD91B',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0x800B4740470C85035015a7B38DedB0f4bB82c985',
    COUPON_CONTRACT_ADDRESS: '0xD08600fbE01fA09490d387974CC915aD7f254A91',
    PERMISSIONS_CONTRACT_ADDRESS: '0x823e6B949D4972230cc9637FE83EdB080e0D72dd',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://devauth.velocitynetwork.foundation/oauth/token',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    DEEP_LINK_PROTOCOL: 'velocity-network-devnet://',
    LIB_URL: 'https://devlib.velocitynetwork.foundation',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://devlib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
  }),
  '--velocity-testnet': Object.freeze({
    RPC_NODE_URL: 'https://stagingmember.velocitycareerlabs.io',
    CHAIN_ID: '1481',
    REGISTRAR_URL: 'https://stagingregistrar.velocitynetwork.foundation',
    REVOCATION_CONTRACT_ADDRESS: '0x1C29461C7480d1d8570df7c0A4F314D0bE8cD5Bf',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0x1550b4f24368c8Eb839073ac04673777D9dda60A',
    COUPON_CONTRACT_ADDRESS: '0xC172E0F7aed123Cd23c2fE0b33020f9e96B0c4Be',
    PERMISSIONS_CONTRACT_ADDRESS: '0xDC088C3D1dC820De88A1b0DCCB25bA6B6f4A74ba',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://stagingauth.velocitynetwork.foundation/oauth/token',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    DEEP_LINK_PROTOCOL: 'velocity-network-testnet://',
    LIB_URL: 'https://staginglib.velocitynetwork.foundation',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://staginglib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
  }),
  '--velocity-mainnet': Object.freeze({
    RPC_NODE_URL: 'https://member.velocitycareerlabs.io',
    CHAIN_ID: '1482',
    REGISTRAR_URL: 'https://registrar.velocitynetwork.foundation',
    REVOCATION_CONTRACT_ADDRESS: '0x8264cCaEa3Cacf851e6DEd77999dDB6cde6977DB',
    METADATA_REGISTRY_CONTRACT_ADDRESS:
      '0xE3AA014F2c6796ca9Da615893433D933A6A2D1c9',
    COUPON_CONTRACT_ADDRESS: '0xAE1d4258c60843a03875550C1e5E71BD8248BF84',
    PERMISSIONS_CONTRACT_ADDRESS: '0x94710f19BB98bd444F984BBD8624aF2b3F9471eE',
    VNF_OAUTH_TOKENS_ENDPOINT:
      'https://auth.velocitynetwork.foundation/oauth/token',
    BLOCKCHAIN_API_AUDIENCE: 'https://velocitynetwork.node',
    DEEP_LINK_PROTOCOL: 'velocity-network://',
    LIB_URL: 'https://lib.velocitynetwork.foundation',
    CREDENTIAL_EXTENSIONS_CONTEXT_URL:
      'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
  }),
});

module.exports = { VELOCITY_NETWORK_PRESETS };
