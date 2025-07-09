const truffleAssert = require('truffle-assertions');
const { Wallet, AbiCoder, keccak256 } = require('ethers');
const { signAddress } = require('@verii/blockchain-functions');

const Permissions = artifacts.require(
  '../../permissions/contracts/Permissions'
);

const RevocationRegistry = artifacts.require('../contracts/RevocationRegistry');

const setupContracts = async (primary) => {
  const permissionsContractInstance = await Permissions.new();
  await permissionsContractInstance.initialize();

  const revocationRegistryInstance = await RevocationRegistry.new();
  await revocationRegistryInstance.initialize();
  await revocationRegistryInstance.setPermissionsAddress(
    permissionsContractInstance.address
  );

  await permissionsContractInstance.addPrimary(primary, primary, primary);
  await permissionsContractInstance.addAddressScope(
    primary,
    'transactions:write'
  );

  return { revocationRegistryInstance, permissionsContractInstance };
};

contract('Revocation Registry', async (accounts) => {
  const deployerAccount = accounts[0];
  const tokenOwner = accounts[1];
  const primaryAccount = tokenOwner;
  const permissionsAccount = primaryAccount;
  const operatorAccount = accounts[2];
  const randomTxAccount = accounts[3];
  const randomNonTxAccount = accounts[4];
  const operatorWallet = new Wallet(
    '0x33f46d353f191f8067dc7d256e9d9ee7a2a3300649ff7c70fe1cd7e5d5237da5'
  );
  const impersonatorWallet = new Wallet(
    '0x4c30c0c2c34f080b4d7dd150f7afa66c3fe000fb037592516f9b85c031e4b6b3'
  );

  describe('Set permission address', async () => {
    let permissionsInstance;
    let revocationRegistryInstance;

    before(async () => {
      const contracts = await setupContracts(primaryAccount, operatorAccount);
      revocationRegistryInstance = contracts.revocationRegistryInstance;
      permissionsInstance = contracts.permissionsContractInstance;
    });

    it('Should allow setup permission if there is no address', async () => {
      const revocationRegistryInstance = await RevocationRegistry.new();
      await revocationRegistryInstance.initialize();

      await revocationRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: operatorAccount }
      );
      await truffleAssert.fails(
        revocationRegistryInstance.setPermissionsAddress(permissionsInstance, {
          from: operatorAccount,
        }),
        'Permissions: caller is not VNF'
      );
    });

    it('Should not allow setup permission if caller is not VNF', async () => {
      const revocationRegistryInstance = await RevocationRegistry.new();
      await revocationRegistryInstance.initialize();

      await revocationRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: primaryAccount }
      );

      await truffleAssert.fails(
        revocationRegistryInstance.setPermissionsAddress(
          permissionsInstance.address,
          { from: operatorAccount }
        ),
        'Permissions: caller is not VNF'
      );
    });

    it('Should allow setup permission if caller is VNF', async () => {
      const revocationRegistryInstance = await RevocationRegistry.new();
      await revocationRegistryInstance.initialize();

      await revocationRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: primaryAccount }
      );
      expect(await revocationRegistryInstance.getPermissionsAddress()).equal(
        permissionsInstance.address
      );

      const SecondPermissionAccount = web3.eth.accounts.create();
      await revocationRegistryInstance.setPermissionsAddress(
        SecondPermissionAccount.address,
        { from: deployerAccount }
      );
      expect(await revocationRegistryInstance.getPermissionsAddress()).equal(
        SecondPermissionAccount.address
      );
    });
  });
  describe('Revocation Registry functionality', async () => {
    let revocationRegistryInstance;
    let permissionsContractInstance;
    before(async () => {
      const contracts = await setupContracts(primaryAccount);
      revocationRegistryInstance = contracts.revocationRegistryInstance;
      permissionsContractInstance = contracts.permissionsContractInstance;
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });

    it('Should not add Revocation without a wallet', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.addRevocationList(3, 'traceId', 'caoDid', {
          from: operatorAccount,
        }),
        'wallet not in registry'
      );
    });

    it('Should fail add wallet if not operator', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.addWallet(
          'traceId',
          'caoDid',
          {
            from: primaryAccount,
          },
          'Reason given: Permissions: operator not pointing to a primary.'
        )
      );
    });

    it('Should add wallet if operator', async () => {
      const result = await revocationRegistryInstance.addWallet(
        'traceId',
        'caoDid',
        {
          from: operatorAccount,
        }
      );

      truffleAssert.eventEmitted(result, 'WalletAdded', {
        traceId: 'traceId',
        caoDid: 'caoDid',
        wallet: primaryAccount,
      });
    });

    it('Should add Revocation list if operator', async () => {
      const result = await revocationRegistryInstance.addRevocationList(
        1,
        'traceId',
        'caoDid',
        {
          from: operatorAccount,
        }
      );

      truffleAssert.eventEmitted(result, 'RevocationListCreate', {
        wallet: primaryAccount,
        listId: web3.utils.toBN('1'),
        traceId: 'traceId',
        caoDid: 'caoDid',
      });

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        1
      );

      expect(status.toNumber()).to.equal(0);

      const total = await revocationRegistryInstance.getRevocationListCount({
        from: operatorAccount,
      });

      expect(total.toNumber()).to.equal(1);

      expect(
        await revocationRegistryInstance.isListExist(primaryAccount, 1)
      ).to.equal(true);
    });

    it('Should not add Revocation list with same id if operator', async () => {
      await revocationRegistryInstance.addRevocationList(
        2,
        'traceId',
        'caoDid',
        {
          from: operatorAccount,
        }
      );

      await truffleAssert.fails(
        revocationRegistryInstance.addRevocationList(2, 'traceId', 'caoDid', {
          from: operatorAccount,
        }),
        'Reason given: revocation list with given id already exist.'
      );
    });

    describe('Set revoked status', async () => {
      before(async () => {
        const contracts = await setupContracts(primaryAccount);
        revocationRegistryInstance = contracts.revocationRegistryInstance;
        permissionsContractInstance = contracts.permissionsContractInstance;
        await permissionsContractInstance.addOperatorKey(
          primaryAccount,
          operatorAccount,
          { from: permissionsAccount }
        );
      });

      it('Should fail if wallet not pointing to a primary', async () => {
        await truffleAssert.fails(
          revocationRegistryInstance.setRevokedStatus(
            1,
            2,
            'traceId',
            'caoDid'
          ),
          'Permissions: operator not pointing to a primary.'
        );
      });

      it('Should fail if list index is out of bounds', async () => {
        const result = await revocationRegistryInstance.addWallet(
          'traceId',
          'caoDid',
          {
            from: operatorAccount,
          }
        );
        await truffleAssert.fails(
          revocationRegistryInstance.setRevokedStatus(
            1,
            10242,
            'traceId',
            'caoDid',
            {
              from: operatorAccount,
            }
          ),
          'list index out of bound'
        );
      });

      it('setRevokedStatus should properly revoke credential status', async () => {
        await revocationRegistryInstance.addRevocationList(
          1,
          'traceId',
          'caoDid',
          {
            from: operatorAccount,
          }
        );

        const result = await revocationRegistryInstance.setRevokedStatus(
          1,
          2,
          'traceId',
          'caoDid',
          {
            from: operatorAccount,
          }
        );

        truffleAssert.eventEmitted(result, 'RevokedStatusUpdate', {
          owner: primaryAccount,
          listId: web3.utils.toBN('1'),
          index: web3.utils.toBN('2'),
          traceId: 'traceId',
          caoDid: 'caoDid',
        });

        const status = await revocationRegistryInstance.getRevokedStatus(
          primaryAccount,
          1,
          2,
          {
            from: operatorAccount,
          }
        );

        expect(status.toNumber()).to.equal(1);
        expect(
          (
            await revocationRegistryInstance.getRevocationListCount({
              from: operatorAccount,
            })
          ).toNumber()
        ).equal(1);
      });

      it('Should fail if list with list id does not exist', async () => {
        await truffleAssert.fails(
          revocationRegistryInstance.setRevokedStatus(
            11,
            2,
            'traceId',
            'caoDid',
            {
              from: operatorAccount,
            }
          ),
          'revocation list with given id does not exist.'
        );
      });
    });

    describe('Get revoked status', async () => {
      it('Should have correct status number', async () => {
        const status = await revocationRegistryInstance.getRevokedStatus(
          primaryAccount,
          1,
          2,
          {
            from: operatorAccount,
          }
        );

        expect(status.toNumber()).to.equal(1);
      });

      it('Should fail if list index is out of bounds', async () => {
        const total = await revocationRegistryInstance.getRevocationListCount({
          from: operatorAccount,
        });

        await truffleAssert.fails(
          revocationRegistryInstance.getRevokedStatus(
            primaryAccount,
            1,
            10242,
            {
              from: operatorAccount,
            }
          ),
          'list index out of bound'
        );
      });

      it('Should fail if list with list id does not exist', async () => {
        await truffleAssert.fails(
          revocationRegistryInstance.getRevokedStatus(primaryAccount, 11, 2, {
            from: operatorAccount,
          }),
          'revocation list with given id does not exist'
        );
      });

      it('Should fail if wallet does not exist', async () => {
        await truffleAssert.fails(
          revocationRegistryInstance.getRevokedStatus(accounts[3], 11, 2, {
            from: operatorAccount,
          }),
          'wallet not in registry'
        );
      });
    });

    describe('Get revocation list count', async () => {
      before(async () => {
        const contracts = await setupContracts(primaryAccount);
        revocationRegistryInstance = contracts.revocationRegistryInstance;
        permissionsContractInstance = contracts.permissionsContractInstance;
        await permissionsContractInstance.addOperatorKey(
          primaryAccount,
          operatorAccount,
          { from: permissionsAccount }
        );
      });

      it('Should fail if wallet not in the regstry', async () => {
        await truffleAssert.fails(
          revocationRegistryInstance.getRevocationListCount({
            from: operatorAccount,
          }),
          'wallet not in registry'
        );
      });

      it('Should get corect numbers', async () => {
        const result = await revocationRegistryInstance.addWallet(
          'traceId',
          'caoDid',
          {
            from: operatorAccount,
          }
        );
        const total = await revocationRegistryInstance.getRevocationListCount({
          from: operatorAccount,
        });

        expect(total.toNumber()).equal(0);

        await revocationRegistryInstance.addRevocationList(
          1,
          'traceId',
          'caoDid',
          {
            from: operatorAccount,
          }
        );

        expect(
          (
            await revocationRegistryInstance.getRevocationListCount({
              from: operatorAccount,
            })
          ).toNumber()
        ).equal(1);

        await revocationRegistryInstance.addRevocationList(
          2,
          'traceId2',
          'caoDid2',
          {
            from: operatorAccount,
          }
        );

        expect(
          (
            await revocationRegistryInstance.getRevocationListCount({
              from: operatorAccount,
            })
          ).toNumber()
        ).equal(2);
      });
    });
  });
  describe('Revocation Registry signed methods functionality', async () => {
    let revocationRegistryInstance;
    let permissionsContractInstance;
    before(async () => {
      const contracts = await setupContracts(primaryAccount);
      revocationRegistryInstance = contracts.revocationRegistryInstance;
      permissionsContractInstance = contracts.permissionsContractInstance;
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });

    it('addWalletSigned should fail with empty signature', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          '',
          {
            from: randomTxAccount,
          },
          'invalid arrayify value'
        )
      );
    });
    it('addWalletSigned should fail with bad signature length', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
          {
            from: randomTxAccount,
          },
          'invalid signature length'
        )
      );
    });
    it('addWalletSigned should fail with arbitrary signature', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('addWalletSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('addWalletSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('addWalletSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.addWalletSigned(
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('addRevocationListSigned should fail without a wallet', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.addRevocationListSigned(
          3,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          }
        ),
        'wallet not in registry'
      );
    });
    it('addWalletSigned should succeed when signed by the operator', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const result = await revocationRegistryInstance.addWalletSigned(
        'traceId',
        'caoDid',
        signature,
        {
          from: randomTxAccount,
        }
      );

      truffleAssert.eventEmitted(result, 'WalletAdded', {
        traceId: 'traceId',
        caoDid: 'caoDid',
        wallet: primaryAccount,
      });
    });
    it('addRevocationListSigned should succeed', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const result = await revocationRegistryInstance.addRevocationListSigned(
        1,
        'traceId',
        'caoDid',
        signature,
        {
          from: randomTxAccount,
        }
      );

      truffleAssert.eventEmitted(result, 'RevocationListCreate', {
        wallet: primaryAccount,
        listId: web3.utils.toBN('1'),
        traceId: 'traceId',
        caoDid: 'caoDid',
      });

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        1
      );

      expect(status.toNumber()).to.equal(0);

      const total = await revocationRegistryInstance.getRevocationListCount({
        from: operatorAccount,
      });

      expect(total.toNumber()).to.equal(1);

      expect(
        await revocationRegistryInstance.isListExist(primaryAccount, 1)
      ).to.equal(true);
    });
    it('addRevocationListSigned should fail when signed by the operator but has same id', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.addRevocationListSigned(
          1,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          }
        ),
        'Reason given: revocation list with given id already exist.'
      );
    });
    it('setRevokedStatusSigned should fail with empty signature', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          '',
          {
            from: randomTxAccount,
          },
          'invalid arrayify value'
        )
      );
    });
    it('setRevokedStatusSigned should fail with bad signature length', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
          {
            from: randomTxAccount,
          },
          'invalid signature length'
        )
      );
    });
    it('setRevokedStatusSigned should fail with arbitrary signature', async () => {
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('setRevokedStatusSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('setRevokedStatusSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('setRevokedStatusSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          1,
          2,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
    it('setRevokedStatusSigned should properly revoke credential status', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const result = await revocationRegistryInstance.setRevokedStatusSigned(
        1,
        2,
        'traceId',
        'caoDid',
        signature,
        {
          from: randomTxAccount,
        }
      );

      truffleAssert.eventEmitted(result, 'RevokedStatusUpdate', {
        owner: primaryAccount,
        listId: web3.utils.toBN('1'),
        index: web3.utils.toBN('2'),
        traceId: 'traceId',
        caoDid: 'caoDid',
      });

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        2,
        {
          from: operatorAccount,
        }
      );

      expect(status.toNumber()).to.equal(1);
      expect(
        (
          await revocationRegistryInstance.getRevocationListCount({
            from: operatorAccount,
          })
        ).toNumber()
      ).equal(1);
    });
    it('setRevokedStatusSigned should fail when listId Does not exist', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await truffleAssert.fails(
        revocationRegistryInstance.setRevokedStatusSigned(
          2,
          0,
          'traceId',
          'caoDid',
          signature,
          {
            from: randomTxAccount,
          },
          'Permissions: operator not pointing to a primary.'
        )
      );
    });
  });
});
