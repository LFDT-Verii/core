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

const { startOfSecond } = require('date-fns/fp');
const { generateKeyPair } = require('@verii/crypto');
const {
  toEthereumAddress,
  toHexString,
  toNumber,
} = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env } = require('@spencejs/spence-config');
const console = require('console');

const { wait } = require('@verii/common-functions');
const { initVerificationCoupon } = require('../index');
const {
  deployPermissionContract,
  deployVerificationCouponContract,
  deployerPrivateKey,
  rpcProvider,
} = require('./helpers/deploy-contracts');

describe('Verification Coupon', () => {
  jest.setTimeout(30000);

  const expirationTimeNumber = Date.now() + 60 * 60 * 1000;
  const expirationTime = new Date(expirationTimeNumber).toISOString();
  const traceId = 'trackingId';
  const caoDid = 'did:velocity:42';
  const burnerDid = 'did:velocity:123';
  const ownerDid = 'did:velocity:321';
  const context = {
    traceId,
    config: { ...env, caoDid },
    log: console,
  };

  let verificationCouponAddress;
  let verificationCouponAdmin;
  let verificationCoupon;

  let permissionsContractAddress;
  let deployerPermissionsContractInstance;

  let primaryAddress;
  let operatorAddress;

  beforeAll(async () => {
    await mongoFactoryWrapper('test-verification-coupon', context);

    permissionsContractAddress = await deployPermissionContract();
    verificationCouponAddress = await deployVerificationCouponContract(
      permissionsContractAddress,
      context
    );

    verificationCouponAdmin = await initVerificationCoupon(
      {
        privateKey: deployerPrivateKey,
        contractAddress: verificationCouponAddress,
        rpcProvider,
      },
      context
    );

    deployerPermissionsContractInstance = await initPermissions(
      {
        privateKey: deployerPrivateKey,
        contractAddress: permissionsContractAddress,
        rpcProvider,
      },
      context
    );
    verificationCoupon = await initVerificationCouponClient();
  });

  afterEach(async () => {
    await wait(1000);
  });

  afterAll(async () => {
    await mongoCloseWrapper();
  });

  describe('Verification Contract Operations', () => {
    it('Mint token bundle', async () => {
      const mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });
      expect(toHexString(mintEvent.bundleId)).toEqual('0x00');
      expect(mintEvent).toEqual(expect.any(Array));
    });

    it('Mint expired token bundle', async () => {
      const { bundleId } = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        expirationTime: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
        quantity: 1,
        ownerDid,
      });
      expect(await verificationCoupon.isExpired(bundleId)).toEqual(true);
    });

    it('Burn token', async () => {
      const mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });
      const burnCouponEvent = await verificationCoupon.burn(
        mintEvent.bundleId,
        traceId,
        caoDid,
        burnerDid,
        operatorAddress
      );
      expect(mintEvent.bundleId).toEqual(burnCouponEvent.bundleId);
      expect(toHexString(burnCouponEvent.balance)).toEqual('0x00');
    });

    it('Transaction should fail when mint token and burn it twice', async () => {
      const mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });
      await verificationCoupon.burn(
        mintEvent.bundleId,
        traceId,
        caoDid,
        burnerDid,
        operatorAddress
      );
      await expect(
        verificationCoupon.burn(
          mintEvent.bundleId,
          traceId,
          caoDid,
          burnerDid,
          operatorAddress
        )
      ).rejects.toThrow(/execution reverted: "Burn: bundle has no balance"/);
    });
  });

  describe('Pull Verification Coupon Events', () => {
    beforeAll(async () => {
      const mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });
      await verificationCoupon.burn(
        mintEvent.bundleId,
        traceId,
        caoDid,
        burnerDid,
        operatorAddress
      );
    });

    it('Should pull MintCouponBundle event', async () => {
      const result = await verificationCoupon.pullMintCouponBundleEvents();
      expect(result).toEqual({
        eventsCursor: expect.any(Function),
        latestBlock: expect.any(Number),
      });
      let aggregateArrayOfEvents = [];
      for await (const eventsSet of result.eventsCursor()) {
        aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
      }
      expect(toHexString(aggregateArrayOfEvents[0].args.bundleId)).toEqual(
        '0x00'
      );
      expect(aggregateArrayOfEvents[0].fragment.name).toEqual(
        'MintCouponBundle'
      );
    });

    it('Should pull BurnCoupon event', async () => {
      const result1 = await verificationCoupon.pullBurnCouponEvents();
      expect(result1).toEqual({
        eventsCursor: expect.any(Function),
        latestBlock: expect.any(Number),
      });
      let aggregateArrayOfEvents = [];
      for await (const eventsSet of result1.eventsCursor()) {
        aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
      }
      expect(toHexString(aggregateArrayOfEvents[0].args.bundleId)).toEqual(
        '0x02'
      );
      const dateOnEvent = new Date(
        toNumber(aggregateArrayOfEvents[0].args.expirationTime) * 1000
      );
      expect(startOfSecond(dateOnEvent)).toEqual(
        startOfSecond(new Date(expirationTimeNumber))
      );

      expect(aggregateArrayOfEvents[0].fragment.name).toEqual('BurnCoupon');
    });
  });

  describe('Get an unused coupon', () => {
    beforeEach(async () => {
      verificationCoupon = await initVerificationCouponClient();
    });

    it('Get the unused coupon for the account', async () => {
      const mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });
      const couponId = await verificationCoupon.getCoupon(operatorAddress);
      expect(toNumber(couponId)).toEqual(toNumber(mintEvent.bundleId));
    });
    it('Get the next unused coupon when the previous was burned', async () => {
      let mintEvent = await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });

      for (let i = 0; i < 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const burnEvent = await verificationCoupon.burn(
          mintEvent.bundleId,
          traceId,
          caoDid,
          burnerDid,
          operatorAddress
        );
        expect(toNumber(burnEvent.bundleId)).toEqual(
          toNumber(mintEvent.bundleId)
        );
        // eslint-disable-next-line no-await-in-loop
        const mintEvent2 = await verificationCouponAdmin.mint({
          toAddress: primaryAddress,
          quantity: 1,
          expirationTime,
          ownerDid,
        });
        // eslint-disable-next-line no-await-in-loop
        const couponId = await verificationCoupon.getCoupon(operatorAddress);
        expect(toNumber(couponId)).toEqual(toNumber(mintEvent2.bundleId));
        mintEvent = mintEvent2;
      }
    });
    it('Process an error if the account without tokens', async () => {
      expect(verificationCoupon.getCoupon(operatorAddress)).rejects.toThrow(
        'No available tokens'
      );
    });

    it('Process an error if the operator account is not pointing to a primary without tokens', async () => {
      await verificationCouponAdmin.mint({
        toAddress: primaryAddress,
        quantity: 1,
        expirationTime,
        ownerDid,
      });

      const accountWithoutTokens = toEthereumAddress(
        generateKeyPair().publicKey
      );
      expect(
        verificationCoupon.getCoupon(accountWithoutTokens)
      ).rejects.toThrow('Permissions: operator not pointing to a primary');
    });

    it('Throw an error if the params invalid', async () => {
      const invalidAddress = 42;
      await expect(
        verificationCoupon.getCoupon(invalidAddress)
      ).rejects.toThrow(/unsupported addressable value/);
    });
  });

  const initVerificationCouponClient = async () => {
    const primaryKeyPair = generateKeyPair();
    primaryAddress = toEthereumAddress(primaryKeyPair.publicKey);

    await deployerPermissionsContractInstance.addPrimary({
      primary: primaryAddress,
      permissioning: primaryAddress,
      rotation: primaryAddress,
    });
    await deployerPermissionsContractInstance.addAddressScope({
      address: primaryAddress,
      scope: 'transactions:write',
    });

    const operatorKeyPair = generateKeyPair();
    operatorAddress = toEthereumAddress(operatorKeyPair.publicKey);
    await deployerPermissionsContractInstance.addAddressScope({
      address: operatorAddress,
      scope: 'coupon:burn',
    });
    const operatorPermissionsContractClient = await initPermissions(
      {
        privateKey: primaryKeyPair.privateKey,
        contractAddress: permissionsContractAddress,
        rpcProvider,
      },
      context
    );
    await operatorPermissionsContractClient.addOperatorKey({
      primary: primaryAddress,
      operator: operatorAddress,
    });

    return initVerificationCoupon(
      {
        privateKey: operatorKeyPair.privateKey,
        contractAddress: verificationCouponAddress,
        rpcProvider,
      },
      context
    );
  };
});
