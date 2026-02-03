/**
 * Copyright 2023 Velocity Team
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
const { after, afterEach, before, describe, it } = require('node:test');
const { expect } = require('expect');

const { generateKeyPair } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { initProvider } = require('@verii/base-contract-io');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env } = require('@spencejs/spence-config');
const { wait } = require('@verii/common-functions');
const {
  deployTestPermissionsContract,
} = require('./helpers/deploy-test-permissions-contract');

const { initPermissions } = require('../index');

describe('Permissions Contract Test Suite', { timeout: 120000 }, () => {
  const rpcUrl = 'http://localhost:8545';
  const authenticate = () => 'TOKEN';
  const rpcProvider = initProvider(rpcUrl, authenticate);
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  const context = {
    log: console,
    config: { ...env },
  };

  let deployedContract;

  const generateAccount = () => {
    const keyPair = generateKeyPair();
    return { address: toEthereumAddress(keyPair.publicKey), ...keyPair };
  };

  const clientForAddress = async (privateKey, contract) => {
    return initPermissions(
      {
        privateKey,
        contractAddress: await contract.getAddress(),
        rpcProvider,
      },
      context,
    );
  };

  let rotationAccount;
  let permissioningAccount;
  let rootPermissioningContractClient;
  let permissioningContractClient;

  before(async () => {
    await mongoFactoryWrapper('test-permissions', context);

    const rootKeyPair = generateKeyPair();
    deployedContract = await deployTestPermissionsContract(
      rootKeyPair.privateKey,
      rpcUrl,
    );

    rootPermissioningContractClient = await clientForAddress(
      rootKeyPair.privateKey,
      deployedContract,
    );

    rotationAccount = generateAccount();
    permissioningAccount = generateAccount();
    permissioningContractClient = await clientForAddress(
      permissioningAccount.privateKey,
      deployedContract,
    );
  });

  afterEach(async () => {
    await wait(1000);
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  describe('VNF Key Contract Operation Test Suite', () => {
    it('VNF should be able to add a primary account', async () => {
      const primaryAccount = generateAccount();

      await rootPermissioningContractClient.addPrimary({
        primary: primaryAccount.address,
        rotation: rotationAccount.address,
        permissioning: permissioningAccount.address,
      });

      const primaries = await rootPermissioningContractClient.getPrimaries();
      expect(primaries).toEqual([primaryAccount.address]);
    });
    it('Non-VNF key should not be able to add a primary account', async () => {
      const primaryAccount = generateAccount();

      await expect(
        permissioningContractClient.addPrimary({
          primary: primaryAccount.address,
          rotation: rotationAccount.address,
          permissioning: permissioningAccount.address,
        }),
      ).rejects.toThrow(/execution reverted: "Permissions: caller is not VNF"/);
    });

    describe('Address -> Scopes mappings test suite', () => {
      let primaryAccount;
      before(async () => {
        primaryAccount = generateAccount();
        await rootPermissioningContractClient.addPrimary({
          primary: primaryAccount.address,
          rotation: rotationAccount.address,
          permissioning: permissioningAccount.address,
        });
      });

      it('VNF should be able to add a scope to an address', async () => {
        await rootPermissioningContractClient.addAddressScope({
          address: primaryAccount.address,
          scope: 'foo',
        });

        const checkResult =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo',
          );
        expect(checkResult).toEqual(true);
      });

      it('VNF should be able to remove a scope from an address', async () => {
        await rootPermissioningContractClient.removeAddressScope({
          address: primaryAccount.address,
          scope: 'foo',
        });

        const checkResult =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo',
          );
        expect(checkResult).toEqual(false);
      });

      it('VNF should be able to update (add) scopes from an address', async () => {
        await rootPermissioningContractClient.updateAddressScopes({
          address: primaryAccount.address,
          scopesToAdd: ['foo1', 'foo2'],
        });

        const checkResult1 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo1',
          );
        const checkResult2 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo2',
          );
        expect(checkResult1).toEqual(true);
        expect(checkResult2).toEqual(true);
      });

      it('VNF should be able to update (remove) scopes from an address', async () => {
        await rootPermissioningContractClient.updateAddressScopes({
          address: primaryAccount.address,
          scopesToRemove: ['foo1', 'foo2'],
        });

        const checkResult1 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo1',
          );
        const checkResult2 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo2',
          );
        expect(checkResult1).toEqual(false);
        expect(checkResult2).toEqual(false);
      });

      it('VNF should be able to update (add/remove) scopes from an address', async () => {
        await rootPermissioningContractClient.updateAddressScopes({
          address: primaryAccount.address,
          scopesToAdd: ['foo1', 'foo2'],
          scopesToRemove: ['foo3', 'foo4'],
        });

        const checkResult1 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo1',
          );
        const checkResult2 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo2',
          );
        const checkResult3 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo3',
          );
        const checkResult4 =
          await rootPermissioningContractClient.contractClient.checkAddressScope(
            primaryAccount.address,
            'foo4',
          );
        expect(checkResult1).toEqual(true);
        expect(checkResult2).toEqual(true);
        expect(checkResult3).toEqual(false);
        expect(checkResult4).toEqual(false);
      });
    });
  });

  describe('Permissioning key Permissions Contract Operation Test Suite', () => {
    let primaryAccount;

    before(async () => {
      primaryAccount = generateAccount();
      await rootPermissioningContractClient.addPrimary({
        primary: primaryAccount.address,
        rotation: rotationAccount.address,
        permissioning: permissioningAccount.address,
      });
      await rootPermissioningContractClient.addAddressScope({
        address: primaryAccount.address,
        scope: 'transactions:write',
      });
    });
    it("Primary's permissioning key should be able to add an operator", async () => {
      const operatorAccount = generateAccount();
      await expect(
        permissioningContractClient.lookupPrimary(operatorAccount.address),
      ).resolves.toEqual(zeroAddress);

      await expect(async () =>
        permissioningContractClient.contractClient.checkOperator(
          operatorAccount.address,
        ),
      ).rejects.toThrow('Permissions: operator not pointing to a primary');

      await permissioningContractClient.addOperatorKey({
        primary: primaryAccount.address,
        operator: operatorAccount.address,
      });

      await expect(
        permissioningContractClient.lookupPrimary(operatorAccount.address),
      ).resolves.toEqual(primaryAccount.address);

      await expect(
        permissioningContractClient.contractClient.checkOperator(
          operatorAccount.address,
        ),
      ).resolves.toEqual(primaryAccount.address);
    });

    it('Should return zero address if operator has not primary', async () => {
      const { publicKey } = generateKeyPair();
      const address = toEthereumAddress(publicKey);
      await expect(
        permissioningContractClient.lookupPrimary(address),
      ).resolves.toEqual(zeroAddress);
    });

    it("A key that is not the Primary's Permissioning key should not be able to add an operator", async () => {
      const testOperatorKey = toEthereumAddress(generateKeyPair().publicKey);

      await expect(
        rootPermissioningContractClient.addOperatorKey({
          primary: primaryAccount.address,
          operator: testOperatorKey,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not permissioning key"/,
      );
    });

    it("Primary's permissioning key should be able to remove an operator", async () => {
      const operatorAccount = generateAccount();
      await permissioningContractClient.addOperatorKey({
        primary: primaryAccount.address,
        operator: operatorAccount.address,
      });

      await expect(
        permissioningContractClient.lookupPrimary(operatorAccount.address),
      ).resolves.toEqual(primaryAccount.address);

      await permissioningContractClient.removeOperatorKey({
        primary: primaryAccount.address,
        operator: operatorAccount.address,
      });

      await expect(
        permissioningContractClient.lookupPrimary(operatorAccount.address),
      ).resolves.toEqual(zeroAddress);

      await expect(async () =>
        permissioningContractClient.contractClient.checkOperator(
          operatorAccount.address,
        ),
      ).rejects.toThrow('Permissions: operator not pointing to a primary');
    });

    it("A key that is not the Primary's Permissioning key should not be able to remove an operator", async () => {
      const testOperatorAccount = generateAccount();

      await permissioningContractClient.addOperatorKey({
        primary: primaryAccount.address,
        operator: testOperatorAccount.address,
      });

      await expect(
        rootPermissioningContractClient.removeOperatorKey({
          primary: primaryAccount.address,
          operator: testOperatorAccount.address,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not permissioning key"/,
      );
    });

    it("Primary's permissioning key should be able to rotate operators", async () => {
      const testOperatorAccount = generateAccount();
      const newTestOperatorAccount = generateAccount();

      await permissioningContractClient.addOperatorKey({
        primary: primaryAccount.address,
        operator: testOperatorAccount.address,
      });

      await permissioningContractClient.rotateOperatorKey({
        primary: primaryAccount.address,
        newOperator: newTestOperatorAccount.address,
        oldOperator: testOperatorAccount.address,
      });

      await expect(
        permissioningContractClient.lookupPrimary(
          newTestOperatorAccount.address,
        ),
      ).resolves.toEqual(primaryAccount.address);
    });

    it("A key that is not the Primary's Permissioning key should not be able to rotate operators", async () => {
      const testOperatorAccount = generateAccount();
      const newTestOperatorAccount = generateAccount();

      await permissioningContractClient.addOperatorKey({
        primary: primaryAccount.address,
        operator: testOperatorAccount.address,
      });

      await expect(
        rootPermissioningContractClient.rotateOperatorKey({
          primary: primaryAccount.address,
          newOperator: newTestOperatorAccount.address,
          oldOperator: testOperatorAccount.address,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not permissioning key"/,
      );
    });
  });

  describe('Rotation key Permissions Contract Operation Test Suite', () => {
    let primaryAccount;

    before(async () => {
      primaryAccount = generateAccount();
      await rootPermissioningContractClient.addPrimary({
        primary: primaryAccount.address,
        rotation: rotationAccount.address,
        permissioning: permissioningAccount.address,
      });
    });

    it("Primary's Rotation key should be able to rotate Primary's Permissioning key once", async () => {
      const rotationContractClient1 = await clientForAddress(
        rotationAccount.privateKey,
        deployedContract,
      );

      const permissioningAccount2 = generateAccount();
      const rotationAccount2 = generateAccount();
      const rotationContractClient2 = await clientForAddress(
        rotationAccount2.privateKey,
        deployedContract,
      );
      const permissioningAccount3 = generateAccount();
      const rotationAccount3 = generateAccount();
      const permissioningAccount4 = generateAccount();
      const rotationAccount4 = generateAccount();

      // rotate using rotationContractClient1 once
      await rotationContractClient1.rotatePermissioning({
        primary: primaryAccount.address,
        newPermissioning: permissioningAccount2.address,
        newRotation: rotationAccount2.address,
      });

      // unable to repeat rotation using rotationContractClient1
      await expect(async () =>
        rotationContractClient1.rotatePermissioning({
          primary: primaryAccount.address,
          newPermissioning: permissioningAccount3.address,
          newRotation: rotationAccount3.address,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not rotation key"/,
      );

      // rotate using rotationContractClient2 once
      await rotationContractClient2.rotatePermissioning({
        primary: primaryAccount.address,
        newPermissioning: permissioningAccount3.address,
        newRotation: rotationAccount3.address,
      });

      // neither rotationContractClient1 or rotationContractClient2 can be used to rotate
      await expect(async () =>
        rotationContractClient1.rotatePermissioning({
          primary: primaryAccount.address,
          newPermissioning: permissioningAccount4.address,
          newRotation: rotationAccount4.address,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not rotation key"/,
      );

      await expect(async () =>
        rotationContractClient2.rotatePermissioning({
          primary: primaryAccount.address,
          newPermissioning: permissioningAccount4.address,
          newRotation: rotationAccount4.address,
        }),
      ).rejects.toThrow(
        /execution reverted: "Permissions: caller is not rotation key"/,
      );
    });
  });
});
