const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { keccak256, AbiCoder, Wallet } = require('ethers');
const { signAddress } = require('@verii/blockchain-functions');
const { map } = require('lodash/fp');
const { createHash } = require('crypto');
const {
  execute,
  expectRevert,
  findEvent,
  normalizeEntries,
  signerByAddress,
  wrapContract,
} = require('../../test-utils');

const get2BytesHash = (value) => {
  return `0x${createHash('sha256').update(value).digest('hex').slice(0, 4)}`;
};

const oneDaySeconds = 60 * 60 * 24;
const expirationTime = Math.floor(Date.now() / 1000) + 90 * oneDaySeconds;
const expiredTime = expirationTime - 180 * oneDaySeconds;
const testListAlgType = '0x6733';
const testListVersion = '0x6733';
const nonExistentCredentialTypeHash = '0x6732';
const regularIssuingCredentialTypeHash = '0xaf29';
const identityIssuingCredentialTypeHash = '0xeea2';
const contactIssuingCredentialTypeHash = '0x4ffb';

const bytes =
  '0xa6626964787d657468657265756d3a2f2f30783931333231303338323138333134303931322f6765745f63726564656e7469616c5f6d657461646174615f6c6973745f6973737565725f76633f6c69737449643d3930323133393132333231303339323130333231266163636f756e7449643d307831383339313233383231333231336474797065827456657269666961626c6543726564656e7469616c781c43726564656e7469616c4d657461646174614c6973744865616465726669737375657278186469643a76656c6f636974793a30783932313331323331326669737375656474323031392d30382d33325430393a34343a30305a7163726564656e7469616c5375626a656374a262696478186469643a76656c6f636974793a3078393231333132333132666c6973744964fb44138fe0cd20f71c6570726f6f66a5656e6f6e6365fb4429e9f10d9813d9676372656174656474323031392d30382d33325430393a34343a30305a6c70726f6f66507572706f73656f617373657274696f6e4d6574686f6472766572696669636174696f6e4d6574686f64781e6469643a76656c6f636974793a3078393231333132333132236b65792d31636a7773652e2e2e2e2e';
const sampleEntry = [testListVersion, regularIssuingCredentialTypeHash, testListAlgType, bytes, bytes];
const traceId = 'trackingId';
const caoDid = 'did:velocity:42';
const burnerDid = 'did:velocity:321';
const ownerDid = 'did:velocity:123';
const operatorWallet = new Wallet(
  '0x33f46d353f191f8067dc7d256e9d9ee7a2a3300649ff7c70fe1cd7e5d5237da5',
);
const impersonatorWallet = new Wallet(
  '0x4c30c0c2c34f080b4d7dd150f7afa66c3fe000fb037592516f9b85c031e4b6b3',
);
const freeCredentialTypesList = [
  'Email',
  'EmailV1.0',
  'Phone',
  'PhoneV1.0',
  'IdDocument',
  'IdDocumentV1.0',
  'PassportV1.0',
  'DrivingLicenseV1.0',
  'NationalIdCardV1.0',
  'ProofOfAgeV1.0',
  'ResidentPermitV1.0',
];
const freeCredentialTypesBytes2 = map(get2BytesHash, freeCredentialTypesList);

const setupContracts = async ({
  deployerSigner,
  primarySigner,
  primaryAccount,
  operatorAccount,
  signersByAddress,
}) => {
  const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
  const permissionsInstance = await Permissions.deploy();
  await permissionsInstance.waitForDeployment();
  await execute(permissionsInstance.initialize());

  const VerificationCoupon = await ethers.getContractFactory(
    'VerificationCoupon',
    deployerSigner,
  );
  const verificationCouponInstance = await VerificationCoupon.deploy();
  await verificationCouponInstance.waitForDeployment();
  await execute(
    verificationCouponInstance.initialize(
      'Velocity Verification Coupon',
      'https://www.velocitynetwork.foundation/',
    ),
  );
  await execute(
    verificationCouponInstance.setPermissionsAddress(
      await permissionsInstance.getAddress(),
    ),
  );

  const MetadataRegistry = await ethers.getContractFactory(
    'MetadataRegistry',
    deployerSigner,
  );
  const metadataRegistryInstance = await MetadataRegistry.deploy();
  await metadataRegistryInstance.waitForDeployment();
  await execute(
    metadataRegistryInstance.initialize(
      await verificationCouponInstance.getAddress(),
      freeCredentialTypesBytes2,
    ),
  );
  await execute(
    permissionsInstance.addAddressScope(
      await metadataRegistryInstance.getAddress(),
      'coupon:burn',
    ),
  );
  await execute(
    metadataRegistryInstance.setPermissionsAddress(
      await permissionsInstance.getAddress(),
    ),
  );
  await execute(
    permissionsInstance.addPrimary(primaryAccount, primaryAccount, primaryAccount),
  );
  await execute(
    permissionsInstance.addAddressScope(primaryAccount, 'transactions:write'),
  );
  await execute(
    permissionsInstance
      .connect(primarySigner)
      .addOperatorKey(primaryAccount, operatorAccount),
  );
  await execute(
    permissionsInstance
      .connect(primarySigner)
      .addOperatorKey(primaryAccount, operatorWallet.address),
  );

  const wrappedVerificationCouponInstance = await wrapContract(
    verificationCouponInstance,
    signersByAddress,
  );
  const wrappedMetadataRegistryInstance = await wrapContract(
    metadataRegistryInstance,
    signersByAddress,
  );
  const wrappedPermissionsInstance = await wrapContract(
    permissionsInstance,
    signersByAddress,
  );

  return {
    verificationCouponInstance: wrappedVerificationCouponInstance,
    metadataRegistryInstance: wrappedMetadataRegistryInstance,
    permissionsInstance: wrappedPermissionsInstance,
  };
};

describe('MetadataRegistry', () => {
  let signers;
  let signersByAddress;
  let accounts;
  let deployerSigner;
  let primarySigner;
  let deployerAccount;
  let primaryAccount;
  let operatorAccount;
  let randomTxAccount;
  let randomNonTxAccount;

  before(async () => {
    signers = await ethers.getSigners();
    [
      deployerSigner,
      primarySigner,
    ] = signers;
    signersByAddress = await signerByAddress(signers);
    accounts = await Promise.all(signers.map((signer) => signer.getAddress()));
    [deployerAccount, primaryAccount, operatorAccount, randomTxAccount, randomNonTxAccount] =
      accounts;
  });

  describe('Validate the create list and set entry functions', () => {
    let verificationCouponInstance;
    let metadataRegistryInstance;
    let permissionsInstance;

    beforeEach(async () => {
      ({verificationCouponInstance, metadataRegistryInstance, permissionsInstance} = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress }));
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:issue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:identityissue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:contactissue'
      );
    });

    const createMetadataList = async (listId = 1) =>
      metadataRegistryInstance.newMetadataList(
        listId,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount },
      );

    const addEntry = async ({
      listId = 1,
      index = 0,
      credentialType = regularIssuingCredentialTypeHash,
    } = {}) =>
      metadataRegistryInstance.setEntry(
        credentialType,
        bytes,
        listId,
        index,
        traceId,
        caoDid,
        { from: operatorAccount },
      );
    it('Deploy Verification Coupon & Metadata Registry', async () => {
      const VerificationCoupon = await ethers.getContractFactory(
        'VerificationCoupon',
        deployerSigner,
      );
      verificationCouponInstance = await VerificationCoupon.deploy();
      verificationCouponInstance = await wrapContract(
        verificationCouponInstance,
        signersByAddress,
      );
      await verificationCouponInstance.initialize(
        'Velocity Verification Coupon',
        'https://www.velocitynetwork.foundation/',
      );
      const MetadataRegistry = await ethers.getContractFactory(
        'MetadataRegistry',
        deployerSigner,
      );
      metadataRegistryInstance = await MetadataRegistry.deploy();
      metadataRegistryInstance = await wrapContract(
        metadataRegistryInstance,
        signersByAddress,
      );
      await metadataRegistryInstance.initialize(
        verificationCouponInstance.address,
        freeCredentialTypesBytes2,
      );
      await metadataRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
      );
    });
    it('Method isExistMetadataList returns false when the account and list were not created', async () => {
      const result = await metadataRegistryInstance.isExistMetadataList(
        '0x0000000000000000000000000000000000000000',
        42
      );
      assert.equal(result, false);
    });
    it('Create new metadata list should fail if not an operator', async () => {
      await expectRevert(
        metadataRegistryInstance.newMetadataList(
          1,
          testListAlgType,
          testListVersion,
          bytes,
          traceId,
          caoDid
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('Create new metadata list', async () => {
      const result = await metadataRegistryInstance.newMetadataList(
        1,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      const event = findEvent(
        result,
        metadataRegistryInstance,
        'CreatedMetadataList',
      );
      assert.ok(event, 'CreatedMetadataList event was not emitted');
    });
    it('newMetadataListSigned should fail with empty signature', async () => {
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          '',
          { from: randomTxAccount }
        ),
        ['invalid arrayify value', 'invalid BytesLike value']
      );
    });
    it('newMetadataListSigned should fail with bad signature length', async () => {
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
          { from: randomTxAccount }
        ),
        ['invalid signature length', 'invalid BytesLike value']
      );
    });
    it('newMetadataListSigned should fail with arbitrary signature', async () => {
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('newMetadataListSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('newMetadataListSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('newMetadataListSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.newMetadataListSigned(
          1,
          nonExistentCredentialTypeHash,
          nonExistentCredentialTypeHash,
          bytes,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('Create new metadata list with newMetadataListSigned', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const result = await metadataRegistryInstance.newMetadataListSigned(
        2,
        nonExistentCredentialTypeHash,
        nonExistentCredentialTypeHash,
        bytes,
        traceId,
        caoDid,
        signature,
        { from: randomTxAccount }
      );
      const event = findEvent(
        result,
        metadataRegistryInstance,
        'CreatedMetadataList',
      );
      assert.ok(event, 'CreatedMetadataList event was not emitted');
    });
    it('Check if the metadata list exist', async () => {
      await createMetadataList(1);
      const result = await metadataRegistryInstance.isExistMetadataList(
        primaryAccount,
        1
      );
      assert.equal(result, true);
    });
    it('Method isExistMetadataList returns false when only the list were not created', async () => {
      const result = await metadataRegistryInstance.isExistMetadataList(
        accounts[0],
        42
      );
      assert.equal(result, false);
    });
    it('Create list with the created already listId throws an error', async () => {
      await createMetadataList(1);
      await expectRevert(
        createMetadataList(1),
        'List id already used'
      );
    });
    it('setEntry should set entries on the existing list using operator as transactor', async () => {
      await createMetadataList(1);
      const results = [];
      for (let i = 0; i <= 2; i++) {
        results.push(
          metadataRegistryInstance.setEntry(
            regularIssuingCredentialTypeHash,
            bytes,
            1,
            i,
            traceId,
            caoDid,
            { from: operatorAccount }
          )
        );
      }

      const txs = await Promise.all(results);
      txs.forEach((result, i) => {
        const event = findEvent(
          result,
          metadataRegistryInstance,
          'AddedCredentialMetadata',
        );
        assert.ok(event, 'AddedCredentialMetadata event was not emitted');
        assert.deepStrictEqual(
          event.args.toObject(),
          {
            sender: primaryAccount,
            listId: 1n,
            index: BigInt(i),
            credentialType: regularIssuingCredentialTypeHash,
            issuerVc: bytes,
            traceId,
            caoDid,
          },
        );
      });
    });
    it('setEntrySigned should set 3 entries on the existing list using operator as signer', async () => {
      await createMetadataList(1);
      const results = [];
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });

      for (let i = 3; i <= 5; i++) {
        results.push(
          metadataRegistryInstance.setEntrySigned(
            regularIssuingCredentialTypeHash,
            bytes,
            1,
            i,
            traceId,
            caoDid,
            signature,
            { from: randomTxAccount }
          )
        );
      }

      const txs = await Promise.all(results);
      txs.forEach((result, i) => {
        const event = findEvent(
          result,
          metadataRegistryInstance,
          'AddedCredentialMetadata',
        );
        assert.ok(event, 'AddedCredentialMetadata event was not emitted');
        assert.deepStrictEqual(
          event.args.toObject(),
          {
            sender: primaryAccount,
            listId: 1n,
            index: BigInt(i + 3),
            credentialType: regularIssuingCredentialTypeHash,
            issuerVc: bytes,
            traceId,
            caoDid,
          },
        );
      });
    });
    it('setEntrySigned should fallback to regular issuing permission if credentialType is not known', async () => {
      await createMetadataList(1);
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const tx = await metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          6,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
      )
      const event = findEvent(
        tx,
        metadataRegistryInstance,
        'AddedCredentialMetadata',
      );
      assert.ok(event, 'AddedCredentialMetadata event was not emitted');
      assert.deepStrictEqual(
        event.args.toObject(),
        {
          sender: primaryAccount,
          listId: 1n,
          index: 6n,
          credentialType: nonExistentCredentialTypeHash,
          issuerVc: bytes,
          traceId,
          caoDid,
        },
      );
    });
    it('setEntrySigned should fail if primary lacks regular issuing permissions', async () => {
      await createMetadataList(1);
      await permissionsInstance.removeAddressScope(
          primaryAccount,
          'credential:issue'
      );

      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(metadataRegistryInstance.setEntrySigned(
          regularIssuingCredentialTypeHash,
          bytes,
          1,
          0,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
      ), 'Permissions: primary of operator lacks credential:issue permission')
    });
    it('setEntrySigned should fail if primary lacks contact issuing permissions', async () => {
      await createMetadataList(1);
      await permissionsInstance.removeAddressScope(
          primaryAccount,
          'credential:contactissue'
      );

      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(metadataRegistryInstance.setEntrySigned(
          contactIssuingCredentialTypeHash,
          bytes,
          1,
          0,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
      ), 'Permissions: primary of operator lacks credential:contactissue permission')
    });
    it('setEntrySigned should fail if primary lacks identity issuing permissions', async () => {
      await createMetadataList(1);
      await permissionsInstance.removeAddressScope(
          primaryAccount,
          'credential:identityissue'
      );

      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(metadataRegistryInstance.setEntrySigned(
          identityIssuingCredentialTypeHash,
          bytes,
          1,
          0,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
      ), 'Permissions: primary of operator lacks credential:identityissue permission')
    });
    it('setEntrySigned should fail with empty signature', async () => {
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          '',
          { from: randomTxAccount }
        ),
        ['invalid arrayify value', 'invalid BytesLike value']
      );
    });
    it('setEntrySigned should fail with bad signature length', async () => {
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
          { from: randomTxAccount }
        ),
        ['invalid signature length', 'invalid BytesLike value']
      );
    });
    it('setEntrySigned should fail with arbitrary signature', async () => {
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('setEntrySigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('setEntrySigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('setEntrySigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.setEntrySigned(
          nonExistentCredentialTypeHash,
          bytes,
          1,
          7,
          traceId,
          caoDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('setEntry should fail to a non-existent list', async () => {
      await expectRevert(
        metadataRegistryInstance.setEntry(
          regularIssuingCredentialTypeHash,
          bytes,
          3,
          1,
          traceId,
          caoDid,
          { from: operatorAccount }
        ),
        'List Id not aveliable'
      );
    });
    it('setEntry should fail if not operator', async () => {
      await expectRevert(
        metadataRegistryInstance.setEntry(nonExistentCredentialTypeHash, bytes, 2, 1, traceId, caoDid),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('setEntry should fail with an invalid index of an existing list', async () => {
      await createMetadataList(1);
      await expectRevert(
        metadataRegistryInstance.setEntry(
          regularIssuingCredentialTypeHash,
          bytes,
          1,
          10001,
          traceId,
          caoDid,
          { from: operatorAccount }
        ),
        'Invalid index'
      );
    });
    it('setEntry should fail with a previously used index of an existing list', async () => {
      await createMetadataList(1);
      await addEntry({ listId: 1, index: 1 });
      await expectRevert(
        metadataRegistryInstance.setEntry(
          regularIssuingCredentialTypeHash,
          bytes,
          1,
          1,
          traceId,
          caoDid,
          { from: operatorAccount }
        ),
        'Index already used'
      );
    });
  });

  describe('Set permission address', () => {
    let verificationCouponInstance;
    let permissionsInstance;

    beforeEach(async () => {
      ({verificationCouponInstance, permissionsInstance} = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress }));
    });

    it('Should allow setup permission if there is no address', async () => {
      const MetadataRegistry = await ethers.getContractFactory(
        'MetadataRegistry',
        deployerSigner,
      );
      let metadataRegistryInstance = await MetadataRegistry.deploy();
      metadataRegistryInstance = await wrapContract(
        metadataRegistryInstance,
        signersByAddress,
      );
      await metadataRegistryInstance.initialize(
        verificationCouponInstance.address,
        freeCredentialTypesBytes2,
      );

      await metadataRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: operatorAccount }
      );

      await expectRevert(
        metadataRegistryInstance.setPermissionsAddress(permissionsInstance.address, {
          from: operatorAccount,
        }),
        'Permissions: caller is not VNF',
      );
    });

    it('Should not allow setup permission if caller is not VNF', async () => {
      const MetadataRegistry = await ethers.getContractFactory(
        'MetadataRegistry',
        deployerSigner,
      );
      let metadataRegistryInstance = await MetadataRegistry.deploy();
      metadataRegistryInstance = await wrapContract(
        metadataRegistryInstance,
        signersByAddress,
      );
      await metadataRegistryInstance.initialize(
        verificationCouponInstance.address,
        freeCredentialTypesBytes2,
      );

      await metadataRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: primaryAccount }
      );

      await expectRevert(
        metadataRegistryInstance.setPermissionsAddress(
          permissionsInstance.address,
          { from: operatorAccount },
        ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should allow setup permission if caller is VNF', async () => {
      const MetadataRegistry = await ethers.getContractFactory(
        'MetadataRegistry',
        deployerSigner,
      );
      let metadataRegistryInstance = await MetadataRegistry.deploy();
      metadataRegistryInstance = await wrapContract(
        metadataRegistryInstance,
        signersByAddress,
      );
      await metadataRegistryInstance.initialize(
        verificationCouponInstance.address,
        freeCredentialTypesBytes2,
      );

      await metadataRegistryInstance.setPermissionsAddress(
        permissionsInstance.address,
        { from: primaryAccount },
      );
      assert.equal(
        await metadataRegistryInstance.getPermissionsAddress(),
        permissionsInstance.address,
      );

      await metadataRegistryInstance.setPermissionsAddress(accounts[3], {
        from: deployerAccount,
      });
      assert.equal(
        await metadataRegistryInstance.getPermissionsAddress(),
        accounts[3],
      );
    });
  });

  describe('Get entries with coupon', () => {
    let verificationCouponInstance;
    let metadataRegistryInstance;
    let permissionsInstance;
    let couponId;
    beforeEach(async () => {
      ({verificationCouponInstance, metadataRegistryInstance, permissionsInstance} = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress }))
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:issue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:contactissue'
      );
      await verificationCouponInstance.mint(
        primaryAccount,
        expirationTime,
        100,
        traceId,
        ownerDid,
        {
          from: deployerAccount,
        }
      );
      couponId = (
        await verificationCouponInstance.getTokenId(operatorAccount)
      );
      await metadataRegistryInstance.newMetadataList(
        1,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        1,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        2,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[0],
        bytes,
        1,
        3,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
    });
    it('getPaidEntriesSigned should fail with empty signature', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          '',
          { from: randomTxAccount }
        ),
        ['invalid arrayify value', 'invalid BytesLike value']
      );
    });
    it('getPaidEntriesSigned should fail with bad signature length', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
          { from: randomTxAccount }
        ),
        ['invalid signature length', 'invalid BytesLike value']
      );
    });
    it('getPaidEntriesSigned should fail with arbitrary signature', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('getPaidEntriesSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('getPaidEntriesSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('getPaidEntriesSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await expectRevert(
        metadataRegistryInstance.getPaidEntriesSigned(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          signature,
          { from: randomTxAccount }
        ),
        'Permissions: operator not pointing to a primary'
      );
    });
    it('getPaidEntriesSigned should get one entry', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(couponId),
        false,
        'Coupon should not be expired'
      );
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const result = await metadataRegistryInstance.getPaidEntriesSigned(
        [[primaryAccount, 1, 1]],
        traceId,
        caoDid,
        burnerDid,
        signature,
        { from: randomTxAccount }
      );
      
      assert.deepEqual(JSON.parse(JSON.stringify(result.logs[0].args[0])), [
        sampleEntry,
      ]);
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 99);
    });

    it('Get one entry from to the existing list and check that the coupon was burned', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(couponId),
        false,
        'Coupon should not be expired'
      );
      const result = await metadataRegistryInstance.getPaidEntries(
        [[primaryAccount, 1, 1]],
        traceId,
        caoDid,
        burnerDid,
        { from: operatorAccount }
      );
      assert.deepEqual(JSON.parse(JSON.stringify(result.logs[0].args[0])), [
        sampleEntry,
      ]);
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 99);
    });
    it('Get multiple entries from to the existing list and check that the coupon was burned', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(0),
        false,
        'Coupon should not be expired'
      );

      const result = await metadataRegistryInstance.getPaidEntries(
        [
          [primaryAccount, 1, 1],
          [primaryAccount, 1, 2],
          [primaryAccount, 1, 3],
        ],
        traceId,
        caoDid,
        burnerDid,
        { from: operatorAccount }
      );
      assert.deepEqual(JSON.parse(JSON.stringify(result.logs[0].args[0])), [
        ...[0, 1].map(() => sampleEntry),
        [testListVersion, freeCredentialTypesBytes2[0], testListAlgType, bytes, bytes],
      ]);
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 99);
    });
    it('Get duplicated entries if two duplicated Credential Identifiers were requested', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(0),
        false,
        'Coupon should not be expired'
      );

      const result = await metadataRegistryInstance.getPaidEntries(
        [
          [primaryAccount, 1, 1],
          [primaryAccount, 1, 1],
        ],
        traceId,
        caoDid,
        burnerDid,
        { from: operatorAccount }
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.logs[0].args[0])),
        [1, 2].map(() => sampleEntry)
      );
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 99);
    });
    it('Get an entry throws error on condition: accountId is not exist', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(0),
        false,
        'Coupon should not be expired'
      );
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [
            [primaryAccount, 1, 4],
            [primaryAccount, 1, 2],
            [primaryAccount, 1, 3],
          ],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'Index not used'
      );
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 100);
    });
    it('Get an entry throws error on condition: listId is not exist', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(0),
        false,
        'Coupon should not be expired'
      );
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [
            [primaryAccount, 2, 1],
            [primaryAccount, 1, 2],
            [primaryAccount, 1, 3],
          ],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'List id not used'
      );
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 100);
    });
    it('Get an entry throws error on condition: index is not exist', async () => {
      assert.equal(
        await verificationCouponInstance.isExpired(0),
        false,
        'Coupon should not be expired'
      );

      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [
            [accounts[0], 1, 1],
            [primaryAccount, 1, 2],
            [primaryAccount, 1, 3],
          ],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'List id not used'
      );
      const balance = await verificationCouponInstance.balanceOf(
        primaryAccount,
        couponId
      );
      assert.equal(Number(balance), 100);
    });
  });

  describe('Get entries with coupon fails', () => {
    let verificationCouponInstance;
    let metadataRegistryInstance;

    beforeEach(async () => {
      const contracts = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress });
      ({verificationCouponInstance, metadataRegistryInstance} = contracts);

      const {permissionsInstance} = contracts;
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:issue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:contactissue'
      );

      await metadataRegistryInstance.newMetadataList(
        1,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        1,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        2,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[0],
        bytes,
        1,
        3,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
    });

    it('Throws an error when the coupon was not exist', async () => {
      await expectRevert(
        verificationCouponInstance.getTokenId(operatorAccount),
        'No available tokens'
      );
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'No available tokens'
      );
    });
    it('Throws an error when the coupon was burned', async () => {
      await verificationCouponInstance.mint(
        primaryAccount,
        expirationTime,
        2,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      await metadataRegistryInstance.getPaidEntries(
        [[primaryAccount, 1, 1]],
        traceId,
        caoDid,
        burnerDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.getPaidEntries(
        [[primaryAccount, 1, 1]],
        traceId,
        caoDid,
        burnerDid,
        { from: operatorAccount }
      );

      await expectRevert(
        verificationCouponInstance.getTokenId(operatorAccount),
        'No available tokens'
      );
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'No available tokens'
      );
    });

    it('Should burn all expired coupons and use a valid coupon after that', async () => {
      await verificationCouponInstance.mint(
        accounts[1],
        expiredTime,
        100,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      await verificationCouponInstance.mint(
        accounts[1],
        expiredTime,
        100,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      await verificationCouponInstance.mint(
        accounts[1],
        expirationTime,
        100,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      const couponId = (
        await verificationCouponInstance.getTokenId(operatorAccount)
      );
      await assert.equal(
        await verificationCouponInstance.isExpired(couponId),
        false
      );
      await metadataRegistryInstance.getPaidEntries(
        [
          [primaryAccount, 1, 1],
          [primaryAccount, 1, 1],
        ],
        traceId,
        caoDid,
        burnerDid,
        {
          from: operatorAccount,
        }
      );
    });
  });

  describe('Get entries with free types', () => {
    let verificationCouponInstance;
    let metadataRegistryInstance;

    beforeEach(async () => {
      const contracts = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress });
      ({verificationCouponInstance, metadataRegistryInstance} = contracts);

      const {permissionsInstance} = contracts;
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:issue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:contactissue'
      );

      await verificationCouponInstance.mint(
        accounts[0],
        expirationTime,
        100,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      await metadataRegistryInstance.newMetadataList(
        1,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[0],
        bytes,
        1,
        1,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[1],
        bytes,
        1,
        2,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[2],
        bytes,
        1,
        3,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        4,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
    });
    it('Get one entry from the existing list ', async () => {
      const entries = await metadataRegistryInstance.getFreeEntries(
        [[primaryAccount, 1, 1]],
        { from: operatorAccount }
      );

      assert.deepEqual(normalizeEntries(entries), [
        [testListVersion, freeCredentialTypesBytes2[0], testListAlgType, bytes, bytes],
      ]);
    });
    it('Get multiple entries from to the existing list', async () => {
      const entries = await metadataRegistryInstance.getFreeEntries(
        [
          [primaryAccount, 1, 1],
          [primaryAccount, 1, 2],
          [primaryAccount, 1, 3],
        ],
        { from: operatorAccount }
      );
      assert.deepEqual(
        normalizeEntries(entries),
        [0, 1, 2].map((i) => [
          testListVersion,
          freeCredentialTypesBytes2[i],
          testListAlgType,
          bytes,
          bytes,
        ])
      );
    });

    it('Throws an error when the creadential type is not free', async () => {
      await expectRevert(
        metadataRegistryInstance.getFreeEntries([[primaryAccount, 1, 4]], {
          from: operatorAccount,
        }),
        'Only free creadential types is allowed without coupon'
      );
    });

    it('Throws an error for credential types at the index', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid
        ),
        'No paid creadential types'
      );
    });

    it('Throws an error a caller is not an operator', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [[primaryAccount, 1, 4]],
          traceId,
          caoDid,
          burnerDid
        ),
        'Permissions: operator not pointing to a primary'
      );
    });

    it('Throws an error when the creadential type is free but getPaidEntries is used', async () => {
      await expectRevert(
        metadataRegistryInstance.getPaidEntries(
          [[primaryAccount, 1, 1]],
          traceId,
          caoDid,
          burnerDid,
          { from: operatorAccount }
        ),
        'No paid creadential types'
      );
    });
  });

  describe('Update the free types', () => {
    let metadataRegistryInstance;
    const newFreeCredentialTypesList = ['NewType1', 'NewType2', 'NewType3'];
    const newFreeCredentialTypesBytes2 = map(
      get2BytesHash,
      newFreeCredentialTypesList
    );
    beforeEach(async () => {
      ({metadataRegistryInstance} = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress }));
    });
    it('Add new free types', async () => {
      const isFreeBefore = await metadataRegistryInstance.isFreeCredentialType(
        newFreeCredentialTypesBytes2[0]
      );
      await metadataRegistryInstance.addFreeTypes(newFreeCredentialTypesBytes2);
      const isFreeAfter = await metadataRegistryInstance.isFreeCredentialType(
        newFreeCredentialTypesBytes2[0]
      );

      assert.equal(isFreeBefore, false);
      assert.equal(isFreeAfter, true);
    });
    it('Remove new free types', async () => {
      await metadataRegistryInstance.addFreeTypes(newFreeCredentialTypesBytes2);
      const isFreeBefore = await metadataRegistryInstance.isFreeCredentialType(
        newFreeCredentialTypesBytes2[0]
      );
      await metadataRegistryInstance.removeFreeTypes(
        newFreeCredentialTypesBytes2
      );
      const isFreeAfter = await metadataRegistryInstance.isFreeCredentialType(
        newFreeCredentialTypesBytes2[0]
      );

      assert.equal(isFreeBefore, true);
      assert.equal(isFreeAfter, false);
    });
    it('Fail if it is not VNF to add or remove free types', async () => {
      await expectRevert(
        metadataRegistryInstance.addFreeTypes(newFreeCredentialTypesBytes2, {
          from: accounts[3],
        }),
        'The caller is not VNF'
      );
      await expectRevert(
        metadataRegistryInstance.removeFreeTypes(newFreeCredentialTypesBytes2, {
          from: accounts[3],
        }),
        'The caller is not VNF'
      );
    });

    it('Can remove unexisting free types', async () => {
      await metadataRegistryInstance.removeFreeTypes(
        newFreeCredentialTypesBytes2
      );
      await metadataRegistryInstance.removeFreeTypes(
        newFreeCredentialTypesBytes2
      );
    });
  });

  describe('Change verification coupon address', () => {
    let verificationCouponInstance;
    let metadataRegistryInstance;
    beforeEach(async () => {
      const contracts = await setupContracts({ deployerSigner, primarySigner, primaryAccount, operatorAccount, signersByAddress });
      ({verificationCouponInstance, metadataRegistryInstance} = contracts);

      const {permissionsInstance} = contracts;
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:issue'
      );
      await permissionsInstance.addAddressScope(
          primaryAccount,
          'credential:contactissue'
      );

      await verificationCouponInstance.mint(
        accounts[0],
        expirationTime,
        100,
        traceId,
        ownerDid,
        {
          from: accounts[0],
        }
      );
      await metadataRegistryInstance.newMetadataList(
        1,
        testListAlgType,
        testListVersion,
        bytes,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[0],
        bytes,
        1,
        1,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[1],
        bytes,
        1,
        2,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        freeCredentialTypesBytes2[2],
        bytes,
        1,
        3,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
      await metadataRegistryInstance.setEntry(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        4,
        traceId,
        caoDid,
        { from: operatorAccount }
      );
    });
    it('Set new verification coupon address', async () => {
      const VerificationCoupon = await ethers.getContractFactory(
        'VerificationCoupon',
        deployerSigner,
      );
      let verificationCouponInstance2 = await VerificationCoupon.deploy();
      verificationCouponInstance2 = await wrapContract(
        verificationCouponInstance2,
        signersByAddress,
      );
      await verificationCouponInstance2.initialize(
        'Velocity Verification Coupon',
        'https://www.velocitynetwork.foundation/',
      );
      await metadataRegistryInstance.setCouponAddress(
        verificationCouponInstance2.address,
      );
    });
    it('Fails if account is not admin', async () => {
      await expectRevert(
        metadataRegistryInstance.setCouponAddress(
          verificationCouponInstance.address,
          {
            from: accounts[3],
          }
        ),
        'The caller is not VNF'
      );
    });
  });
});
