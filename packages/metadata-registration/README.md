Example of the usage on your localhost with an EVM based blockchain container.

```
const { generateKeyPair } = require('@verii/crypto');
const ethers = require('ethers');
/* eslint-disable no-console */
const { initRevocationRegistry } = require('../index');

const { privateKey } = generateKeyPair();
const wallet = new ethers.Wallet(privateKey);
const contractAddress = '0xf755e1ca66be12f177178e7ea696969e0a55bb64';
const gasLimit = 470000;

const revocationRegistry = initRevocationRegistry({
  privateKey,
  contractAddress,
  rpcUrl: 'http://localhost:8545',
  gasLimit,
});

(async () => {
  const listId = 42;
  const index = 24;
  try {
    await revocationRegistry.addWallet();
    await revocationRegistry.addRevocationList(listId);
    const initialStatus = await revocationRegistry.getRevokedStatus(
      `ethereum:${contractAddress}/getRevokedStatus?address=${wallet.address}&listId=${listId}&index=${index}`
    );
    console.info('initialStatus', initialStatus);
    await revocationRegistry.setRevokedStatus(listId, index);
    const updatedStatus = await revocationRegistry.getRevokedStatus(
      `ethereum:${contractAddress}/getRevokedStatus?address=${wallet.address}&listId=${listId}&index=${index}`
    );
    console.info('updatedStatus', updatedStatus);
  } catch (error) {
    console.error('Revocation Registry Error', error);
  }
})();

```

Output: 
```
initialStatus 0
updatedStatus 1
```