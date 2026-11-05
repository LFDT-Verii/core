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

const { after, afterEach, before, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { last } = require('lodash/fp');
const { getAddress } = require('ethers');
const { generateAccount, toNumber } = require('@verii/blockchain-functions');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env } = require('@spencejs/spence-config');
const console = require('console');
const { initPermissions } = require('@verii/contract-permissions');
const { wait } = require('@verii/common-functions');
const initRevocationRegistry = require('../src/revocation-registry');
const { RevocationRegistryErrorCodes } = require('../src/constants');
const {
  deployPermissionContract,
  deployRevocationContract,
  deployerPrivateKey,
  rpcProvider,
} = require('./helpers/deploy-contracts');

describe('Revocation Registry', { timeout: 240000 }, () => {
  const traceId = 'trackingId';
  const context = {
    traceId,
    config: { ...env },
    log: console,
  };

  let permissionsContractAddress;
  let revocationRegistryContractAddress;
  let revocationRegistry;
  let defaultPrimaryAddress;

  before(async () => {
    await mongoFactoryWrapper('test-revocation-registry', context);

    permissionsContractAddress = await deployPermissionContract();
    revocationRegistryContractAddress = await deployRevocationContract(
      permissionsContractAddress,
      context,
    );
    const { primaryAddress, operatorAccount } =
      await initializationPermissions();
    defaultPrimaryAddress = primaryAddress;
    revocationRegistry = await createRevocationRegistryWallet(operatorAccount);
  });

  afterEach(async () => {
    await wait(1000);
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  describe('The basic usage flow', () => {
    it('Should not fail if the private key string does not have the prefix 0x', async () => {
      const funcWithoutPrefix = async () =>
        initRevocationRegistry(
          {
            privateKey:
              '3d56ba04429baff40300a0213ab0b0ac8932162e860249fe223d71f01c46924e',
            contractAddress: revocationRegistryContractAddress,
            rpcProvider,
          },
          context,
        );
      await expect(funcWithoutPrefix()).resolves.not.toThrow();

      const funcWithPrefix = async () =>
        initRevocationRegistry(
          {
            privateKey:
              '0x3d56ba04429baff40300a0213ab0b0ac8932162e860249fe223d71f01c46924e',
            contractAddress: revocationRegistryContractAddress,
            rpcProvider,
          },
          context,
        );
      await expect(funcWithPrefix()).resolves.not.toThrow();
    });

    it('Throw an error: the wallet not registered', async () => {
      const operatorAccount = generateAccount();

      const revocationRegistryClient = await initRevocationRegistry(
        {
          privateKey: operatorAccount.privateKey,
          contractAddress: revocationRegistryContractAddress,
          rpcProvider,
        },
        context,
      );
      await expect(
        revocationRegistryClient.addRevocationListSigned(42, 'did:velocity:99'),
      ).rejects.not.toBe(null);
    });

    it('Add a wallet and a revocation list, to set/get a revoked status', async () => {
      const listId = 5442;
      const index = 24;

      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );
      const initialStatus = await revocationRegistry.getRevokedStatus(
        `ethereum:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
      );
      expect(initialStatus).toEqual(0n);
      await revocationRegistry.setRevokedStatusSigned({
        accountId: defaultPrimaryAddress,
        listId,
        index,
        caoDid: 'did:velocity:99',
      });
      const updatedStatus = await revocationRegistry.getRevokedStatus(
        `ethereum:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
      );
      expect(updatedStatus).toEqual(1n);
    });

    it('Get a revoked status without private key', async () => {
      const listId = 4222;
      const index = 24;
      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );
      await revocationRegistry.setRevokedStatusSigned({
        accountId: defaultPrimaryAddress,
        listId,
        index,
        caoDid: 'did:velocity:99',
      });

      const revocationRegistryNoKey = await initRevocationRegistry(
        {
          contractAddress: revocationRegistryContractAddress,
          rpcProvider,
        },
        context,
      );

      const status = await revocationRegistryNoKey.getRevokedStatus(
        `ethereum:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
      );
      expect(status).toEqual(1n);
    });

    it('Setup the revocationRegistry and get a correct revocation url', async () => {
      const listId = 42;
      const index = 24;

      const url = revocationRegistry.getRevokeUrl(
        defaultPrimaryAddress,
        listId,
        index,
      );
      expect(url).toEqual(
        `ethereum:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
      );
    });

    it('Throw an error: Required params for initialization', async () => {
      await expect(async () =>
        initRevocationRegistry(
          {
            rpcProvider,
          },
          context,
        ),
      ).rejects.toThrow('Check the required parameters: contractAddress');
    });

    it('Throw an error: the wallet already added', async () => {
      await expect(async () =>
        revocationRegistry.addWalletToRegistrySigned({
          caoDid: 'did:velocity:99',
        }),
      ).rejects.toThrow(/execution reverted: "wallet already in registry"/);
    });

    it('Throw an error: the revocation list is not exist', async () => {
      const listId = 4200;
      const index = 24;

      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );

      await expect(async () =>
        revocationRegistry.getRevokedStatus(
          `ethereum:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${
            listId + 1
          }&index=${index}`,
        ),
      ).rejects.toThrow(/revocation list with given id does not exist/);
    });

    it('Throw an error: the index shoud be < 10240', async () => {
      const listId = 423;
      const index = 10240;

      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );

      await expect(async () =>
        revocationRegistry.setRevokedStatusSigned({
          accountId: defaultPrimaryAddress,
          listId,
          index,
          caoDid: 'did:velocity:99',
        }),
      ).rejects.toThrow(/execution reverted: "list index out of bound"/);
    });

    it('Throw an error: invalid url params', async () => {
      const listId = 4290;
      const index = 24;

      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );

      expect(() => {
        revocationRegistry.getRevokedStatus(
          `ethereum:${revocationRegistryContractAddress}/invalidMethod?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
        );
      }).toThrow(
        expect.objectContaining({
          message:
            'Wrong url, please check the params: scheme, target_address, function_name',
          code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
        }),
      );
      expect(() => {
        revocationRegistry.getRevokedStatus(
          `ethereum:${defaultPrimaryAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
        );
      }).toThrow(
        expect.objectContaining({
          message:
            'Wrong url, please check the params: scheme, target_address, function_name',
          code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
        }),
      );
      expect(() => {
        revocationRegistry.getRevokedStatus(
          `eth:${revocationRegistryContractAddress}/getRevokedStatus?address=${defaultPrimaryAddress}&listId=${listId}&index=${index}`,
        );
      }).toThrow(
        expect.objectContaining({
          message: 'Not an Ethereum URI',
          code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
        }),
      );
    });
  });

  describe('Pull Revocation Registry Events', { timeout: 60000 }, () => {
    const listId = 1000;
    const index = 1000n;
    before(async () => {
      await revocationRegistry.addRevocationListSigned(
        listId,
        'did:velocity:99',
      );
      await revocationRegistry.setRevokedStatusSigned({
        accountId: defaultPrimaryAddress,
        listId,
        index,
        caoDid: 'did:velocity:99',
      });
    });

    it('Should pull WalletAdded event', async () => {
      const result = await revocationRegistry.pullWalletAddedEvents();
      expect(result).toEqual({
        eventsCursor: expect.any(Function),
        latestBlock: expect.any(Number),
      });
      let aggregateArrayOfEvents = [];
      for await (const eventsSet of result.eventsCursor()) {
        aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
      }
      expect(last(aggregateArrayOfEvents).args[0]).toEqual(
        defaultPrimaryAddress,
      );
      expect(last(aggregateArrayOfEvents).fragment.name).toEqual('WalletAdded');
    });

    it('Should pull RevocationListCreate event', async () => {
      const result = await revocationRegistry.pullRevocationListCreateEvents();
      expect(result).toEqual({
        eventsCursor: expect.any(Function),
        latestBlock: expect.any(Number),
      });
      let aggregateArrayOfEvents = [];
      for await (const eventsSet of result.eventsCursor()) {
        aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
      }
      expect(last(aggregateArrayOfEvents).args[0]).toEqual(
        defaultPrimaryAddress,
      );
      expect(toNumber(last(aggregateArrayOfEvents).args[1])).toEqual(listId);
      expect(last(aggregateArrayOfEvents).fragment.name).toEqual(
        'RevocationListCreate',
      );
    });

    it('Should pull RevokedStatusUpdate event', async () => {
      const result = await revocationRegistry.pullRevokedStatusUpdateEvents();
      expect(result).toEqual({
        eventsCursor: expect.any(Function),
        latestBlock: expect.any(Number),
      });
      let aggregateArrayOfEvents = [];
      for await (const eventsSet of result.eventsCursor()) {
        aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
      }
      expect(last(aggregateArrayOfEvents).args[0]).toEqual(
        defaultPrimaryAddress,
      );
      expect(toNumber(last(aggregateArrayOfEvents).args[1])).toEqual(listId);
      expect(last(aggregateArrayOfEvents).args[2]).toEqual(index);
      expect(last(aggregateArrayOfEvents).fragment.name).toEqual(
        'RevokedStatusUpdate',
      );
    });
  });

  const createRevocationRegistryWallet = async (operatorAccount) => {
    const revocationRegistryClient = await initRevocationRegistry(
      {
        privateKey: operatorAccount.privateKey,
        contractAddress: revocationRegistryContractAddress,
        rpcProvider,
      },
      context,
    );
    await revocationRegistryClient.addWalletToRegistrySigned({
      caoDid: 'did:velocity:99',
    });
    return revocationRegistryClient;
  };

  const initializationPermissions = async () => {
    const primaryAccount = generateAccount();
    const primaryAddress = primaryAccount.address;

    const permissionsContractRootClient = await initPermissions(
      {
        privateKey: deployerPrivateKey,
        contractAddress: permissionsContractAddress,
        rpcProvider,
      },
      context,
    );

    await permissionsContractRootClient.addPrimary({
      primary: primaryAddress,
      permissioning: primaryAddress,
      rotation: primaryAddress,
    });
    await permissionsContractRootClient.addAddressScope({
      address: primaryAddress,
      scope: 'transactions:write',
    });

    const operatorPermissionsClient = await initPermissions(
      {
        privateKey: primaryAccount.privateKey,
        contractAddress: permissionsContractAddress,
        rpcProvider,
      },
      context,
    );

    const operatorAccount = generateAccount();
    const operatorAddress = operatorAccount.address;
    await operatorPermissionsClient.addOperatorKey({
      primary: primaryAddress,
      operator: operatorAddress,
    });
    return { primaryAddress, operatorAddress, operatorAccount };
  };
});

describe('getRevokedStatus url validation', () => {
  const contractAddress = `0x${'a'.repeat(40)}`;
  const holderAddress = `0x${'b'.repeat(40)}`;
  const query = `?address=${holderAddress}&listId=1&index=2`;
  const statusUrl = (params) =>
    `ethereum:${contractAddress}/getRevokedStatus?${new URLSearchParams({
      address: holderAddress,
      listId: '1',
      index: '2',
      ...params,
    })}`;
  const valuesMessage =
    'Wrong url, please check the values of the params: address, listId, index';
  const context = {
    log: { info: () => {}, warn: () => {}, error: () => {} },
  };

  let revocationRegistry;

  before(async () => {
    // no rpcProvider: any contract call fails, so these checks happen first
    revocationRegistry = await initRevocationRegistry(
      { contractAddress },
      context,
    );
  });

  [
    {
      title: 'names another function',
      url: `ethereum:${contractAddress}/setRevokedStatus${query}`,
      message:
        'Wrong url, please check the params: scheme, target_address, function_name',
    },
    {
      title: 'names another revocation contract',
      url: `ethereum:0x${'c'.repeat(40)}/getRevokedStatus${query}`,
      message:
        'Wrong url, please check the params: scheme, target_address, function_name',
    },
    {
      title: 'uses another scheme',
      url: `eth:${contractAddress}/getRevokedStatus${query}`,
      message: 'Not an Ethereum URI',
    },
    {
      title: 'cannot be parsed',
      url: 'ethereum:revoked',
      message: 'Missing prefix',
    },
    {
      title: 'is not a string',
      url: undefined,
      message: 'uri must be a string',
    },
    {
      title: 'has no parameters',
      url: `ethereum:${contractAddress}/getRevokedStatus`,
      message: 'Wrong url, please check the params: address, listId, index',
    },
    {
      title: 'lacks a parameter',
      url: `ethereum:${contractAddress}/getRevokedStatus?address=${holderAddress}&listId=1`,
      message: 'Wrong url, please check the params: address, listId, index',
    },
    {
      title: 'has a listId that is not a number',
      url: statusUrl({ listId: 'not-a-number' }),
      message: valuesMessage,
    },
    {
      title: 'has an empty listId',
      url: statusUrl({ listId: '' }),
      message: valuesMessage,
    },
    {
      title: 'has a negative index',
      url: statusUrl({ index: '-1' }),
      message: valuesMessage,
    },
    {
      title: 'has an index of 2^256',
      url: statusUrl({ index: String(2n ** 256n) }),
      message: valuesMessage,
    },
    {
      title: 'has an index that does not fit uint32',
      url: statusUrl({ index: String(2n ** 32n) }),
      message: valuesMessage,
    },
    {
      title: 'has a listId that does not fit uint256',
      url: statusUrl({ listId: String(2n ** 256n) }),
      message: valuesMessage,
    },
    {
      title: 'has an address with a bad checksum',
      url: statusUrl({ address: `0x${'aB'.repeat(20)}` }),
      message: valuesMessage,
    },
    {
      title: 'has an address that is too short',
      url: statusUrl({ address: '0x1234' }),
      message: valuesMessage,
    },
    {
      title: 'has an ICAP address',
      url: statusUrl({ address: 'XE7338O073KYGTWWZN0F2WZ0R8PX5ZPPZS' }),
      message: valuesMessage,
    },
  ].forEach(({ title, url, message }) => {
    it(`should throw an invalid_revocation_url error when the url ${title}`, () => {
      expect(() => revocationRegistry.getRevokedStatus(url)).toThrow(
        expect.objectContaining({
          message,
          code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
        }),
      );
    });
  });

  [
    { title: 'decimal values', params: {} },
    {
      title: 'a checksummed address',
      params: { address: getAddress(`0x${'1a'.repeat(20)}`) },
    },
    { title: 'a hex listId', params: { listId: '0x0c' } },
    { title: 'leading zeros', params: { listId: '007', index: '0002' } },
    {
      title: 'the largest uint32 index',
      params: { index: String(2n ** 32n - 1n) },
    },
    {
      title: 'the largest uint256 listId',
      params: { listId: String(2n ** 256n - 1n) },
    },
  ].forEach(({ title, params }) => {
    it(`should make the contract call for a url with ${title}, and not set the code when it fails`, async () => {
      const rpc = {
        call: mock.fn(async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:8545');
        }),
      };
      const registryWithRpc = await initRevocationRegistry(
        { contractAddress, rpcProvider: rpc },
        context,
      );

      const result = Promise.resolve().then(() =>
        registryWithRpc.getRevokedStatus(statusUrl(params)),
      );

      await expect(result).rejects.toThrow('ECONNREFUSED');
      await expect(result).rejects.not.toMatchObject({
        code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
      });
      expect(rpc.call.mock.callCount()).toEqual(1);
    });
  });
});
