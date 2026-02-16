const assert = require('node:assert/strict');
const { ethers } = require('hardhat');

const zeroAddress = ethers.ZeroAddress;

const execute = async (txPromise) => {
  const tx = await txPromise;
  return tx.wait();
};

const expectRevert = async (action, expectedMessage) => {
  try {
    await action();
    assert.fail(`Expected revert with: ${expectedMessage}`);
  } catch (error) {
    const message = String(error?.message || error);
    assert.ok(
      message.includes(expectedMessage),
      `Expected message "${expectedMessage}", got "${message}"`,
    );
  }
};

describe('VNF functions', () => {
  describe('Permissions', () => {
    let permissionsContractInstance;
    let signers;
    let vnfAddress;
    let mockAddress1;

    before(async () => {
      signers = await ethers.getSigners();
      [vnfAddress, mockAddress1] = await Promise.all([
        signers[0].getAddress(),
        signers[1].getAddress(),
      ]);

      const Permissions = await ethers.getContractFactory('Permissions');
      permissionsContractInstance = await Permissions.deploy();
      await permissionsContractInstance.waitForDeployment();
      await execute(permissionsContractInstance.initialize());
    });

    it('Should deploy the permissions contract', async () => {
      assert.notEqual(await permissionsContractInstance.getAddress(), zeroAddress);
    });

    it('Should have initialized the contract with the VNF address', async () => {
      assert.equal(
        await permissionsContractInstance.getVNF(),
        vnfAddress,
        'vnf address does not match',
      );
    });

    it('Should fail to rotate the VNF address when not called by VNF', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[1])
              .rotateVNF(mockAddress1),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should fail to rotate the VNF address to the 0 address', async () => {
      await expectRevert(
        () => execute(permissionsContractInstance.rotateVNF(zeroAddress)),
        'Permissions: address is 0 address',
      );
    });

    it('Should rotate the VNF address', async () => {
      await execute(permissionsContractInstance.rotateVNF(mockAddress1));
      assert.equal(
        await permissionsContractInstance.getVNF(),
        mockAddress1,
        'vnf address was not rotated properly',
      );
    });
  });
});

describe('Address -> Scopes mappings test suite', () => {
  describe('Permissions', () => {
    let permissionsContractInstance;
    let signers;
    let vnfAddress;
    let mockAddress1;

    before(async () => {
      signers = await ethers.getSigners();
      [vnfAddress, mockAddress1] = await Promise.all([
        signers[0].getAddress(),
        signers[1].getAddress(),
      ]);

      const Permissions = await ethers.getContractFactory('Permissions');
      permissionsContractInstance = await Permissions.deploy();
      await permissionsContractInstance.waitForDeployment();
      await execute(permissionsContractInstance.initialize());
    });

    it('Should deploy the permissions contract', async () => {
      assert.notEqual(await permissionsContractInstance.getAddress(), zeroAddress);
    });

    it('Should return an empty addressToPermissions map', async () => {
      const hasScope = await permissionsContractInstance.checkAddressScope(
        vnfAddress,
        'foo',
      );
      assert.equal(hasScope, false, 'hasScope should be false initially');
    });

    it('Should fail when non VNF address tries to add a scope for an address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[1])
              .addAddressScope(vnfAddress, 'foo'),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should fail when VNF address tries to add a scope for the 0 address', async () => {
      await expectRevert(
        () => execute(permissionsContractInstance.addAddressScope(zeroAddress, 'foo')),
        'Permissions: address is 0 address',
      );
    });

    it('Should allow VNF to add scope to an address', async () => {
      await execute(permissionsContractInstance.addAddressScope(mockAddress1, 'foo'));
      const hasFooScope = await permissionsContractInstance.checkAddressScope(
        mockAddress1,
        'foo',
      );
      assert.equal(hasFooScope, true, 'should have foo scope');
    });

    it('Should fail when non VNF address tries to remove a scope from an address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[1])
              .removeAddressScope(vnfAddress, 'foo'),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should allow VNF to remove scope from an address', async () => {
      await execute(permissionsContractInstance.removeAddressScope(mockAddress1, 'foo'));
      const hasFooScope = await permissionsContractInstance.checkAddressScope(
        mockAddress1,
        'foo',
      );
      assert.equal(hasFooScope, false, 'should not have foo scope');
    });

    it('Should allow VNF to remove a scope from the 0 address', async () => {
      await execute(permissionsContractInstance.removeAddressScope(zeroAddress, 'foo'));
      const hasFooScope = await permissionsContractInstance.checkAddressScope(
        zeroAddress,
        'foo',
      );
      assert.equal(hasFooScope, false, 'should not have foo scope');
    });

    it('updateAddressScopes should fail when not VNF', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[1])
              .updateAddressScopes(vnfAddress, ['fooadd1'], ['fooremove1']),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('updateAddressScopes should update scopes for an address', async () => {
      await execute(permissionsContractInstance.addAddressScope(mockAddress1, 'fooremove'));
      assert.equal(
        await permissionsContractInstance.checkAddressScope(mockAddress1, 'fooremove'),
        true,
        'should have fooremove scope before removal',
      );
      assert.equal(
        await permissionsContractInstance.checkAddressScope(mockAddress1, 'fooadd'),
        false,
        'should not have fooadd scope initially',
      );

      await execute(
        permissionsContractInstance.updateAddressScopes(
          mockAddress1,
          ['fooadd'],
          ['fooremove'],
        ),
      );

      const hasFooAddScope = await permissionsContractInstance.checkAddressScope(
        mockAddress1,
        'fooadd',
      );
      const hasFooRemoveScope = await permissionsContractInstance.checkAddressScope(
        mockAddress1,
        'fooremove',
      );
      assert.equal(hasFooAddScope, true, 'should have fooadd scope');
      assert.equal(hasFooRemoveScope, false, 'should not have fooremove scope');
    });

    it('updateAddressScopes should update scopes for the 0 address', async () => {
      await execute(
        permissionsContractInstance.updateAddressScopes(
          zeroAddress,
          ['fooadd'],
          ['fooremove'],
        ),
      );
      const hasFooAddScope = await permissionsContractInstance.checkAddressScope(
        zeroAddress,
        'fooadd',
      );
      const hasFooRemoveScope = await permissionsContractInstance.checkAddressScope(
        zeroAddress,
        'fooremove',
      );
      assert.equal(hasFooAddScope, true, 'should have fooadd scope');
      assert.equal(hasFooRemoveScope, false, 'should not have fooremove scope');
    });
  });
});

describe('Permissions test suite', () => {
  describe('Permissions', () => {
    let permissionsContractInstance;
    let signers;

    let primary1;
    let permissioning1;
    let rotation1;
    let operator1;
    let operator2;
    let unknown1;

    let permissioning2;
    let rotation2;

    before(async () => {
      signers = await ethers.getSigners();
      [
        primary1,
        permissioning1,
        rotation1,
        permissioning2,
        rotation2,
        operator1,
        operator2,
        unknown1,
      ] = await Promise.all([
        signers[1].getAddress(),
        signers[2].getAddress(),
        signers[3].getAddress(),
        signers[4].getAddress(),
        signers[5].getAddress(),
        signers[6].getAddress(),
        signers[7].getAddress(),
        signers[8].getAddress(),
      ]);

      const Permissions = await ethers.getContractFactory('Permissions');
      permissionsContractInstance = await Permissions.deploy();
      await permissionsContractInstance.waitForDeployment();
      await execute(permissionsContractInstance.initialize());
    });

    it('Should deploy the permissions contract', async () => {
      assert.notEqual(await permissionsContractInstance.getAddress(), zeroAddress);
    });

    it('Adding a primary account should fail when called by non VNF address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[1])
              .addPrimary(primary1, permissioning1, rotation1),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Adding a primary account should fail when primary is 0 address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance.addPrimary(
              zeroAddress,
              permissioning1,
              rotation1,
            ),
          ),
        'Permissions: address is 0 address',
      );
    });

    it('Adding a primary account should succeed when called by VNF address', async () => {
      const result = await execute(
        permissionsContractInstance.addPrimary(primary1, permissioning1, rotation1),
      );
      assert.ok(result, 'addPrimary should resolve');

      const primaries = await permissionsContractInstance.getPrimaries();
      assert.equal(
        primaries[0],
        primary1,
        'primaries array does not contain the correct primary address',
      );
      assert.equal(primaries.length, 1, 'primaries array should have 1 element');
    });

    it('Rotating a permissioning address should fail when a non rotation address of the primary address is used', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[8])
              .rotatePermissioning(primary1, permissioning2, rotation2),
          ),
        'Permissions: caller is not rotation key',
      );
    });

    it('Rotation a permissioning address should succeed when rotation address of the primary address is used', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[3])
          .rotatePermissioning(primary1, permissioning2, rotation2),
      );
      assert.ok(result, 'rotatePermissioning should resolve');
    });

    it('Rotation a permissioning address should succeed again when rotation address of the primary address is used', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[5])
          .rotatePermissioning(primary1, permissioning1, rotation1),
      );
      assert.ok(result, 'rotatePermissioning should resolve');
    });

    it('Lookup Primary should return 0 address when operator address is not mapped to a primary account', async () => {
      const primary = await permissionsContractInstance.lookupPrimary(unknown1);
      assert.equal(primary, zeroAddress, primary);
    });

    it('Lookup Primary should return 0 address when operator is the 0 address', async () => {
      const primary = await permissionsContractInstance.lookupPrimary(zeroAddress);
      assert.equal(primary, zeroAddress, primary);
    });

    it('Add Operator should fail when call is made by address other than the permissioning address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[8])
              .addOperatorKey(primary1, operator1),
          ),
        'Permissions: caller is not permissioning key',
      );
    });

    it('Add Operator should fail when operator is 0 address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[2])
              .addOperatorKey(primary1, zeroAddress),
          ),
        'Permissions: address is 0 address',
      );
    });

    it('Add Operator should succeed when call is made by permissioning address', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .addOperatorKey(primary1, operator1),
      );
      assert.ok(result, 'addOperatorKey should resolve');

      const primaryOfOperator = await permissionsContractInstance.lookupPrimary(
        operator1,
      );
      assert.equal(
        primaryOfOperator,
        primary1,
        "Unexpected value of operator's primary key",
      );
    });

    it('Add Operator should fail when operator is already pointing to primary', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[2])
              .addOperatorKey(primary1, operator1),
          ),
        'Permissions: operator is already mapped to a primary',
      );
    });

    it('Remove Operator should fail when call is made by address other than the permissioning address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[8])
              .removeOperatorKey(primary1, operator1),
          ),
        'Permissions: caller is not permissioning key',
      );
    });

    it('Remove Operator should succeed when primary address is invalid', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .removeOperatorKey(primary1, operator2),
      );
      assert.ok(result);
    });

    it('Remove Operator should succeed when call is made by permissioning address', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .removeOperatorKey(primary1, operator1),
      );
      assert.ok(result, 'removeOperatorKey should resolve');

      const primary = await permissionsContractInstance.lookupPrimary(operator1);
      assert.equal(primary, zeroAddress, primary);
    });

    it('Rotate Operator should fail when call is made by address other than the permissioning address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[8])
              .rotateOperatorKey(primary1, operator1, operator2),
          ),
        'Permissions: caller is not permissioning key',
      );
    });

    it('Rotate Operator should fail when new operator is the 0 address', async () => {
      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[2])
              .rotateOperatorKey(primary1, zeroAddress, operator1),
          ),
        'Permissions: address is 0 address',
      );
    });

    it('Rotate Operator should fail when new operator is already pointing to primary', async () => {
      await execute(
        permissionsContractInstance
          .connect(signers[2])
          .addOperatorKey(primary1, operator1),
      );

      await expectRevert(
        () =>
          execute(
            permissionsContractInstance
              .connect(signers[2])
              .rotateOperatorKey(primary1, operator1, operator2),
          ),
        'Permissions: operator is already mapped to a primary',
      );
    });

    it('Rotate Operator should succeed', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .rotateOperatorKey(primary1, operator2, operator1),
      );
      assert.ok(result, 'rotateOperatorKey should resolve');

      const oldOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        operator1,
      );
      assert.equal(oldOperatorPrimary, zeroAddress, oldOperatorPrimary);

      const newOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        operator2,
      );
      assert.equal(newOperatorPrimary, primary1, newOperatorPrimary);
    });

    it('Rotate Operator should succeed when old operator key is not pointing to a primary', async () => {
      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .rotateOperatorKey(primary1, operator1, unknown1),
      );
      assert.ok(result, 'rotateOperatorKey should resolve');

      const oldOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        unknown1,
      );
      assert.equal(oldOperatorPrimary, zeroAddress, oldOperatorPrimary);

      const newOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        operator1,
      );
      assert.equal(newOperatorPrimary, primary1, newOperatorPrimary);
    });

    it('Rotate Operator should succeed when old operator key is the 0 address', async () => {
      await execute(
        permissionsContractInstance
          .connect(signers[2])
          .removeOperatorKey(primary1, operator1),
      );

      const result = await execute(
        permissionsContractInstance
          .connect(signers[2])
          .rotateOperatorKey(primary1, operator1, zeroAddress),
      );
      assert.ok(result, 'rotateOperatorKey should resolve');

      const oldOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        zeroAddress,
      );
      assert.equal(oldOperatorPrimary, zeroAddress, oldOperatorPrimary);

      const newOperatorPrimary = await permissionsContractInstance.lookupPrimary(
        operator1,
      );
      assert.equal(newOperatorPrimary, primary1, newOperatorPrimary);
    });

    it('Check Operator should fail if operator is not pointing to a primary', async () => {
      await expectRevert(
        () => permissionsContractInstance.checkOperator(unknown1),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('Check Operator should fail if operator is 0 address', async () => {
      await expectRevert(
        () => permissionsContractInstance.checkOperator(zeroAddress),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('Check Operator should fail if primary of operator lacks transactions:write scope', async () => {
      await expectRevert(
        () => permissionsContractInstance.checkOperator(operator1),
        'Permissions: primary of operator lacks transactions:write scope',
      );
    });

    it('checkOperatorWithScope should fail if primary of operator lacks specified scope', async () => {
      await expectRevert(
        () => permissionsContractInstance.checkOperatorWithScope(operator1, 'foo'),
        'Permissions: primary of operator lacks transactions:write scope',
      );
    });

    it('Check Operator should succeed when operator is pointing to a primary', async () => {
      await execute(
        permissionsContractInstance.addAddressScope(primary1, 'transactions:write'),
      );
      const primaryOfOperator = await permissionsContractInstance.checkOperator(
        operator1,
      );
      assert.equal(
        primaryOfOperator,
        primary1,
        "Unexpected value of operator's primary key",
      );
    });

    it('checkOperatorWithScope should succeed when operator is pointing to a primary', async () => {
      await execute(permissionsContractInstance.addAddressScope(primary1, 'foo'));
      const primaryOfOperator =
        await permissionsContractInstance.checkOperatorWithScope(operator1, 'foo');
      assert.equal(
        primaryOfOperator,
        primary1,
        "Unexpected value of operator's primary key or scope",
      );
    });

    describe('"checkOperatorPermission" Test Suite', () => {
      it('checkOperatorPermission should fail if operator is not pointing to a primary', async () => {
        await expectRevert(
          () => permissionsContractInstance.checkOperatorPermission(unknown1, 'foo'),
          'Permissions: operator not pointing to a primary',
        );
      });

      it('checkOperatorPermission should fail if primary of operator lacks requested permission', async () => {
        await execute(permissionsContractInstance.removeAddressScope(primary1, 'foo'));
        await expectRevert(
          () => permissionsContractInstance.checkOperatorPermission(operator1, 'foo'),
          'Permissions: primary of operator lacks requested permission',
        );
      });

      it('checkOperatorPermission should fail if requested permission is empty string', async () => {
        await expectRevert(
          () => permissionsContractInstance.checkOperatorPermission(operator1, ''),
          'Permissions: permission may not be empty',
        );
      });

      it('checkOperatorPermission should succeed if primary of operator has requested permission', async () => {
        await execute(permissionsContractInstance.removeAddressScope(primary1, 'foo'));
        await execute(permissionsContractInstance.addAddressScope(primary1, 'foo'));
        const primary = await permissionsContractInstance.checkOperatorPermission(
          operator1,
          'foo',
        );
        assert.equal(
          primary,
          primary1,
          "Unexpected value of operator's primary key or scope",
        );
      });
    });
  });
});
