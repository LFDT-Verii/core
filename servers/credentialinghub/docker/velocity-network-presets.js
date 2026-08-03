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
    ROOT_PUBLIC_KEY:
      '04994b86e03d6c7d115c678762b346619b092d3da10245b0b7473357de598688711bfdd4f4fd6ed4b20296efb6f47573a132255400a9ad8a9174de023ceffafcb1',
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
    ROOT_PUBLIC_KEY:
      '045d43947e4f767e87f6a6200de1d95b56be49bb1d610304dbe360715e80a4b06a2d2af14097b2766d499d99fdaf319e949b1ce450701683db8b429feef39a6759',
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
    ROOT_PUBLIC_KEY:
      '0400b8ce252db73ab92e33d4cb79a21377884540d0d7981dd23fcc1d5a916db2fcda8f286e35b663ad5123bd1423b8bdae5137bc785444a8077e89580ce33dfab3',
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
