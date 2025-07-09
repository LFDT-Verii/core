Example of the usage on your localhost with an EVM based blockchain container.

```
const { generateKeyPair } = require('@verii/crypto');
const ethers = require('ethers');
/* eslint-disable no-console */
const { initPermissions } = require('../index');

const { privateKey } = generateKeyPair();
const wallet = new ethers.Wallet(privateKey);
const contractAddress = '0xf755e1ca66be12f177178e7ea696969e0a55bb64';
const gasLimit = 470000;

const permissions = initPermissions({
  privateKey,
  contractAddress,
  rpcUrl: 'http://localhost:8545',
  gasLimit,
});

(async () => {
  try {
    await permissions.addPrimary(publicKeyAddress, permissioningAddress, rotationAddress );
    console.info('initialStatus', initialStatus);
  } catch (error) {
    console.error('Revocation Registry Error', error);
  }
})();

```