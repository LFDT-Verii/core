const { Wallet } = require('ethers');
const { signAddress } = require('../src/sign-arguments');

describe('getTransactionSignature test suite', () => {
  it('should return a valid signature', async () => {
    const transactingWallet = Wallet.createRandom();
    const signerWallet = Wallet.createRandom();
    const signature = await signAddress({
      address: transactingWallet.address,
      signerWallet,
    });
    expect(signature).toBeDefined();
  });
});
