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

const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
} = require('node:test');
const { expect } = require('expect');

const {
  generateKeyPair,
  get2BytesHash,
  generateJWAKeyPair,
} = require('@verii/crypto');
const { compact, first, map, omit, reduce } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env } = require('@spencejs/spence-config');
const console = require('console');

const { mapWithIndex, wait } = require('@verii/common-functions');
const {
  deployPermissionContract,
  deployVerificationCouponContract,
  deployMetadataContract,
  rpcProvider,
  deployerPrivateKey,
} = require('./helpers/deploy-contracts');
const { initMetadataRegistry, initVerificationCoupon } = require('../index');
const { ALG_TYPE } = require('../src/constants');

const testListAlgType = '0x6b86';
const testListVersion = '0xa38d';
const regularIssuingCredentialType = 'AssessmentV1.1';
const regularIssuingCredentialTypeHash = get2BytesHash(
  regularIssuingCredentialType,
);
const identityIssuingCredentialTypeHash = '0xdeef';
const contactIssuingCredentialTypeHash = '0x4ffb';

const bytes =
  // eslint-disable-next-line max-len
  '0x65794a30655841694f694a4b563151694c434a72615751694f694a6b61575136646d567362324e7064486b364d48686b4e47526d4d6a6b334d6a5a6b4e5441775a6a6c694f445669597a5a6a4e325978596a4e6a4d4449785a6a45324d7a41314e6a6b794932746c65533078496977695957786e496a6f6952564d794e545a4c496e302e65794a325979493665794a306558426c496a7062496b4e795a57526c626e52705957784e5a5852685a47463059557870633352495a57466b5a5849695853776959334a6c5a47567564476c6862464e31596d706c593351694f6e736962476c7a64456c6b496a6f784d6a4d73496d466a59323931626e524a5a434936496a42344d54566a515455784e6a4931513055354e6a51315a4463774d54557a4e5449774e6d45325254597a596a42454d5464684d5441354f534a396653776961584e7a496a6f695a476c6b4f6e5a6c6247396a615852354f6a42345a44526b5a6a49354e7a49325a4455774d475935596a6731596d4d32597a646d4d57497a597a41794d5759784e6a4d774e5459354d694973496d703061534936496d5630614756795a5856744f6a42344d4449794e444d304d6a49774e6d4d77597a51354f54466c4f44646959554a6b516a6c47596a5a6c513255304d44526a4e3252465153396e5a5854516f584a6c5a47567564476c686245316c6447466b5958526854476c7a64456c7a6333566c636c5a445032466b5a484a6c63334d394d4867784e574e424e5445324d6a564452546b324e44566b4e7a41784e544d314d6a413259545a464e6a4e694d4551784e3245784d446b354a6d78706333524a5a4430784d6a4d694c434a70595851694f6a45324e4441794e6a6b344e545173496d35695a6949364d5459304d4449324f5467314e48302e4179555a753977626942756a4f506853756b5278495843504c65334b36475a68734b2d6431337036704d667855685048366b5a41475a6d534562635166484d33456845726237507378664971475f75546572366f2d67';

const bytes2 =
  // eslint-disable-next-line max-len
  '0x65794a30655841694f694a4b563151694c434a68624763694f694a46557a49314e6b73694c434a72615751694f694a6b615751365a586868625842735a54706c55336c545955564c6332317a5247303152544a5965564642556e596a646d567362324e7064486b74613256354c54456966512e65794a325979493665794a705a434936496d5630614756795a5856744f6e56755a47566d6157356c5a43396e5a5854516f584a6c5a47567564476c686245316c6447466b5958526854476c7a64456c7a6333566c636c5a445032466b5a484a6c63334d394d48686c4d7a6b78516a597a52544979597a55304d6a564351554d314f5451334d7a6b314e4467334e324d304e5441304f575269516a63794a6d78706333524a5a4430794e5441304d5449314d6a67794e7a4d7a4f446b694c434a306558426c496a7062496b4e795a57526c626e52705957784e5a5852685a47463059557870633352495a57466b5a5849695853776961584e7a64575679496a6f695a476c6b4f6d563459573177624755365a564e355532464653334e74633052744e55557957486c5251564a324969776959334a6c5a47567564476c6862464e31596d706c593351694f6e736962476c7a64456c6b496a6f794e5441304d5449314d6a67794e7a4d7a4f446b73496d466a59323931626e524a5a434936496a42345a544d354d5549324d3055794d6d4d314e444931516b46444e546b304e7a4d354e5451344e7a646a4e4455774e446c6b596b49334d694a3966537769626d4a6d496a6f784e7a49774e6a59334e7a59794c434a7164476b694f694a6c6447686c636d563162547031626d526c5a6d6c755a5751765a325630304b46795a57526c626e52705957784e5a5852685a474630595578706333524a63334e315a584a57517a39685a4752795a584e7a505442345a544d354d5549324d3055794d6d4d314e444931516b46444e546b304e7a4d354e5451344e7a646a4e4455774e446c6b596b49334d695a7361584e30535751394d6a55774e4445794e5449344d6a637a4d7a67354969776961584e7a496a6f695a476c6b4f6d563459573177624755365a564e355532464653334e74633052744e55557957486c5251564a324969776961574630496a6f784e7a49774e6a59334e7a597966512e47345774666d77344531626557635f4142354b4f6b663248574141626e5a3379654b7263526a3439433650346b4e7451512d384d656c6c6e444c747236437046774867364f324354446f7671775a3134337944614f51';

const vc =
  // eslint-disable-next-line max-len
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksiLCJraWQiOiJkaWQ6ZXhhbXBsZTplU3lTYUVLc21zRG01RTJYeVFBUnYjdmVsb2NpdHkta2V5LTEifQ.eyJ2YyI6eyJpZCI6ImV0aGVyZXVtOnVuZGVmaW5lZC9nZXTQoXJlZGVudGlhbE1ldGFkYXRhTGlzdElzc3VlclZDP2FkZHJlc3M9MHhlMzkxQjYzRTIyYzU0MjVCQUM1OTQ3Mzk1NDg3N2M0NTA0OWRiQjcyJmxpc3RJZD0yNTA0MTI1MjgyNzMzODkiLCJ0eXBlIjpbIkNyZWRlbnRpYWxNZXRhZGF0YUxpc3RIZWFkZXIiXSwiaXNzdWVyIjoiZGlkOmV4YW1wbGU6ZVN5U2FFS3Ntc0RtNUUyWHlRQVJ2IiwiY3JlZGVudGlhbFN1YmplY3QiOnsibGlzdElkIjoyNTA0MTI1MjgyNzMzODksImFjY291bnRJZCI6IjB4ZTM5MUI2M0UyMmM1NDI1QkFDNTk0NzM5NTQ4NzdjNDUwNDlkYkI3MiJ9fSwibmJmIjoxNzIwNjY3NzYyLCJqdGkiOiJldGhlcmV1bTp1bmRlZmluZWQvZ2V00KFyZWRlbnRpYWxNZXRhZGF0YUxpc3RJc3N1ZXJWQz9hZGRyZXNzPTB4ZTM5MUI2M0UyMmM1NDI1QkFDNTk0NzM5NTQ4NzdjNDUwNDlkYkI3MiZsaXN0SWQ9MjUwNDEyNTI4MjczMzg5IiwiaXNzIjoiZGlkOmV4YW1wbGU6ZVN5U2FFS3Ntc0RtNUUyWHlRQVJ2IiwiaWF0IjoxNzIwNjY3NzYyfQ.G4Wtfmw4E1beWc_AB5KOkf2HWAAbnZ3yeKrcRj49C6P4kNtQQ-8MellnDLtr6CpFwHg6O2CTDovqwZ143yDaOQ';

const sampleEntry = [
  testListAlgType,
  regularIssuingCredentialTypeHash,
  testListVersion,
  bytes,
  bytes2,
];

const sampleEntryContactFree = [
  testListAlgType,
  contactIssuingCredentialTypeHash,
  testListVersion,
  bytes,
  bytes2,
];

const traceId = nanoid();
const caoDid = 'did:velocity:42';
const ownerDid = 'did:velocity:321';
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
const sampleEntryFree = [
  testListAlgType,
  identityIssuingCredentialTypeHash,
  testListVersion,
  bytes,
  bytes2,
];
const defaultCredentialType = 'Certification';

const password =
  '3dbc33ed4f3b5ca79d75a698e2b36f6010604a96c3126ec3d326aa222a71bde0';

describe('Metadata Registry', { timeout: 600000 }, () => {
  let metadataAddress;

  const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  let operatorMetadataRegistryClient;
  let deployerPermissionsClient;
  let deployerVerificationCouponClient;
  let primaryAddress;
  let operatorAddress;
  let context;

  const { publicKey: credentialKey } = generateKeyPair({ format: 'jwk' });

  before(async () => {
    context = {
      traceId,
      config: { ...env },
      log: console,
    };
    await mongoFactoryWrapper('test-metadata-registry', context);

    const permissionsAddress = await deployPermissionContract();
    const verificationCouponAddress = await deployVerificationCouponContract(
      permissionsAddress,
      context,
    );
    metadataAddress = await deployMetadataContract(
      freeCredentialTypesList,
      verificationCouponAddress,
      permissionsAddress,
      context,
    );

    const primaryKeyPair = generateKeyPair();
    primaryAddress = toEthereumAddress(primaryKeyPair.publicKey);

    const operatorKeyPair = generateKeyPair();
    operatorAddress = toEthereumAddress(operatorKeyPair.publicKey);

    deployerVerificationCouponClient = await initVerificationCoupon(
      {
        privateKey: deployerPrivateKey,
        contractAddress: verificationCouponAddress,
        rpcProvider,
      },
      context,
    );

    deployerPermissionsClient = await initPermissions(
      {
        privateKey: deployerPrivateKey,
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      context,
    );
    await deployerPermissionsClient.addPrimary({
      primary: primaryAddress,
      permissioning: primaryAddress,
      rotation: primaryAddress,
    });

    const operatorPermissionsClient = await initPermissions(
      {
        privateKey: primaryKeyPair.privateKey,
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      context,
    );
    await operatorPermissionsClient.addOperatorKey({
      primary: primaryAddress,
      operator: operatorAddress,
    });

    await deployerPermissionsClient.addAddressScope({
      address: primaryAddress,
      scope: 'transactions:write',
    });
    await deployerPermissionsClient.addAddressScope({
      address: primaryAddress,
      scope: 'credential:issue',
    });

    operatorMetadataRegistryClient = await initMetadataRegistry(
      {
        privateKey: operatorKeyPair.privateKey,
        contractAddress: metadataAddress,
        rpcProvider,
      },
      context,
    );
  });

  afterEach(async () => {
    await wait(1000);
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  describe('Create credential metadata list', () => {
    before(async () => {
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'transactions:write',
      });
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'credential:issue',
      });
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'credential:identityissue',
      });
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'credential:contactissue',
      });
    });
    it('Create a new legacy list', async () => {
      const result =
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          1001,
          vc,
          caoDid,
        );
      expect(result).toEqual(true);
    });

    it('Create a COSE key list', async () => {
      const result =
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          2001,
          vc,
          caoDid,
          ALG_TYPE.COSEKEY_AES_256,
        );
      expect(result).toEqual(true);
    });

    it('Missed the algType, version parameters', async () => {
      const result =
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          1002,
          vc,
          caoDid,
          '',
          '',
        );
      expect(result).toEqual(true);
    });
    it('should return false if list already exists', async () => {
      const listId = 1003;
      await operatorMetadataRegistryClient.createCredentialMetadataList(
        primaryAddress,
        listId,
        vc,
        caoDid,
      );

      const result =
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          listId,
          vc,
          caoDid,
        );
      expect(result).toEqual(false);
    });
  });

  [
    { algType: ALG_TYPE.COSEKEY_AES_256, listId: 3001, title: 'COSE key' },
    { algType: ALG_TYPE.HEX_AES_256, listId: 3002, title: 'legacy' },
  ].forEach(({ algType, listId, title }) => {
    describe(`Add ${title} entry to credential metadata list`, () => {
      const baseCredentialMetadata = {
        listId,
        index: 1,
        publicKey: credentialKey,
        credentialTypeEncoded: get2BytesHash(defaultCredentialType),
      };

      before(async () => {
        await deployerPermissionsClient.addAddressScope({
          address: primaryAddress,
          scope: 'credential:identityissue',
        });
        await deployerPermissionsClient.addAddressScope({
          address: primaryAddress,
          scope: 'credential:contactissue',
        });
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          listId,
          vc,
          caoDid,
          algType,
        );
      });

      it('Use an existing cose key list', async () => {
        const metadata = {
          ...baseCredentialMetadata,
          index: Math.floor(Math.random() * 10000),
        };

        const result0 =
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          );

        expect(result0).toEqual(true);
      });

      it('Allow issuing an unknown credential type as long as primary has regular issuing permissions', async () => {
        const metadata = {
          ...baseCredentialMetadata,
          index: Math.floor(Math.random() * 10000),
          credentialTypeEncoded: get2BytesHash('foo'),
        };

        const result =
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          );
        expect(result).toEqual(true);
      });

      it('Error when issuing to a filled slot', async () => {
        await operatorMetadataRegistryClient.addCredentialMetadataEntry(
          baseCredentialMetadata,
          password,
          caoDid,
          algType,
        );

        const result =
          operatorMetadataRegistryClient.addCredentialMetadataEntry(
            baseCredentialMetadata,
            password,
            caoDid,
            algType,
          );
        await expect(result).rejects.toThrow('Index already used');
      });

      // TODO FIX non-existent list error
      it('Error when issuing to non-existent list', async () => {
        const metadata = {
          ...baseCredentialMetadata,
          list: Math.floor(Math.random() * 10000),
        };

        await expect(
          operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          ),
        ).rejects.toThrow('Index already used');
      });

      it('Error when primary lacks regular issuing permission', async () => {
        await deployerPermissionsClient.removeAddressScope({
          address: primaryAddress,
          scope: 'credential:issue',
        });
        const metadata = {
          ...baseCredentialMetadata,
          index: Math.floor(Math.random() * 10000),
        };

        try {
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          );

          await deployerPermissionsClient.addAddressScope({
            address: primaryAddress,
            scope: 'credential:issue',
          });

          expect(true).toEqual('should have thrown');
        } catch (e) {
          await deployerPermissionsClient.addAddressScope({
            address: primaryAddress,
            scope: 'credential:issue',
          });

          expect(e.errorCode).toEqual('career_issuing_not_permitted');
        }
      });

      it('Error when primary lacks identity issuing permission', async () => {
        await deployerPermissionsClient.removeAddressScope({
          address: primaryAddress,
          scope: 'credential:identityissue',
        });
        const metadata = {
          ...baseCredentialMetadata,
          index: Math.floor(Math.random() * 10000),
          credentialTypeEncoded: get2BytesHash('DriversLicenseV1.0'),
        };
        try {
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          );
          expect(true).toEqual('should have thrown');
        } catch (e) {
          expect(e.errorCode).toEqual('identity_issuing_not_permitted');
        }
      });

      it('Error when primary lacks contact issuing permission', async () => {
        await deployerPermissionsClient.removeAddressScope({
          address: primaryAddress,
          scope: 'credential:contactissue',
        });
        const metadata = {
          ...baseCredentialMetadata,
          index: Math.floor(Math.random() * 10000),
          credentialTypeEncoded: get2BytesHash('EmailV1.0'),
        };
        try {
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            metadata,
            password,
            caoDid,
            algType,
          );
          expect(true).toEqual('should have thrown');
        } catch (e) {
          expect(e.errorCode).toEqual('contact_issuing_not_permitted');
        }
      });
    });
  });

  describe('parsing dids', () => {
    it('Parse multi DID fails', () => {
      const indexEntries = [
        [operatorAddress, '1', '1'],
        [operatorAddress, '1', '2', 'xyz'],
      ];
      const did = buildMultiDid(indexEntries, 'did:wrongformat:');
      expect(() =>
        operatorMetadataRegistryClient.parseVelocityV2Did(did),
      ).toThrow(`Wrong did ${did}`);
    });

    it('Parse multi did succeeds', async () => {
      const indexEntries = [
        [operatorAddress, '1', '1'], // velocity v2
        [operatorAddress, '1', '2', 'xyz'], // velocity v2.1 including contentHash
      ];
      const did = buildMultiDid(indexEntries);
      await expect(
        operatorMetadataRegistryClient.parseVelocityV2Did(did),
      ).toEqual(
        map(
          ([accountId, listId, index, contentHash]) => ({
            accountId,
            listId,
            index,
            contentHash,
          }),
          indexEntries,
        ),
      );
    });
  });

  describe('Check the free credential type', () => {
    it('Check the credential types list when all are free', async () => {
      const checkList = await Promise.all(
        freeCredentialTypesList.map((type) =>
          operatorMetadataRegistryClient.isFreeCredentialType(type),
        ),
      );
      expect(checkList.every((check) => check)).toEqual(true);
      expect(
        await operatorMetadataRegistryClient.isFreeCredentialTypeList(
          freeCredentialTypesList,
        ),
      ).toEqual(true);
    });
    it('Check the credential types list when one of them is not free', async () => {
      const checkList = await Promise.all(
        [...freeCredentialTypesList, 'NotFreeType'].map((type) =>
          operatorMetadataRegistryClient.isFreeCredentialType(type),
        ),
      );
      expect(checkList.every((check) => check)).toEqual(false);
      expect(
        await operatorMetadataRegistryClient.isFreeCredentialTypeList([
          ...freeCredentialTypesList,
          'NotFreeType',
        ]),
      ).toEqual(false);
    });
  });

  describe('Reading from credential metadata lists', () => {
    const burnerDid = 'did:ion:123';

    before(async () => {
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'credential:identityissue',
      });
      await deployerPermissionsClient.addAddressScope({
        address: primaryAddress,
        scope: 'credential:contactissue',
      });
      await deployerPermissionsClient.addAddressScope({
        address: metadataAddress,
        scope: 'coupon:burn',
      });
      await operatorMetadataRegistryClient.createCredentialMetadataList(
        primaryAddress,
        1,
        vc,
        caoDid,
      );
      await operatorMetadataRegistryClient.setEntrySigned(
        regularIssuingCredentialTypeHash,
        bytes,
        1,
        1,
        traceId,
        caoDid,
      );
      await operatorMetadataRegistryClient.setEntrySigned(
        identityIssuingCredentialTypeHash,
        bytes,
        1,
        2,
        traceId,
        caoDid,
      );
      await operatorMetadataRegistryClient.setEntrySigned(
        contactIssuingCredentialTypeHash,
        bytes,
        1,
        3,
        traceId,
        caoDid,
      );
    });

    it('Check if the metadata list exists', async () => {
      const result = await operatorMetadataRegistryClient.isExistMetadataList(
        1,
        primaryAddress,
      );
      expect(result).toEqual(true);
    });

    it('Check if the metadata list does not exist', async () => {
      const result = await operatorMetadataRegistryClient.isExistMetadataList(
        42,
        primaryAddress,
      );
      expect(result).toEqual(false);
    });

    describe('Get entries with & without coupon', () => {
      beforeEach(async () => {
        await deployerVerificationCouponClient.mint({
          toAddress: primaryAddress,
          quantity: 1,
          expirationTime,
          ownerDid,
        });
      });
      it('Get an entry wihout coupon fails if the credential type is not free ', async () => {
        const entryIndexes = [[primaryAddress, 1, 1]];
        await operatorMetadataRegistryClient.getPaidEntriesSigned(
          entryIndexes,
          traceId,
          caoDid,
          burnerDid,
        );
        await expect(
          operatorMetadataRegistryClient.getPaidEntriesSigned(
            entryIndexes,
            traceId,
            caoDid,
            burnerDid,
          ),
        ).rejects.toThrow('No available tokens');
        const contractError = await operatorMetadataRegistryClient
          .getPaidEntriesSigned(entryIndexes, traceId, caoDid, burnerDid)
          .catch((error) => error);
        expect(contractError.reason).toEqual('No available tokens');
        await expect(
          deployerVerificationCouponClient.getCoupon(operatorAddress),
        ).rejects.toThrow('No available tokens');
      });
      it('Get an paid entry', async () => {
        const entryIndexes = [[primaryAddress, 1, 1]];
        const entries =
          await operatorMetadataRegistryClient.getPaidEntriesSigned(
            entryIndexes,
            traceId,
            caoDid,
            burnerDid,
          );
        entries.map((entry, i) =>
          expect(JSON.parse(JSON.stringify(entry))).toEqual(expectedEntries[i]),
        );
      });
      it('Get an entry without coupon if the credential type is free', async () => {
        const entryIndexes = [[primaryAddress, 1, 2]];

        const entries =
          await operatorMetadataRegistryClient.getFreeEntries(entryIndexes);
        entries.map((entry) =>
          expect(JSON.parse(JSON.stringify(entry))).toEqual([
            testListAlgType,
            identityIssuingCredentialTypeHash,
            testListVersion,
            bytes,
            bytes2,
          ]),
        );
      });

      it('Get multiple entries', async () => {
        const entryIndexes = [
          [primaryAddress, 1, 1],
          [primaryAddress, 1, 2],
          [primaryAddress, 1, 3],
        ];
        const entries =
          await operatorMetadataRegistryClient.getPaidEntriesSigned(
            entryIndexes,
            traceId,
            caoDid,
            burnerDid,
          );
        entries.map((entry, i) =>
          expect(JSON.parse(JSON.stringify(entry))).toEqual(expectedEntries[i]),
        );
      });
    });

    describe('Resolve credential metadata from contract', () => {
      // let baseCredentialMetadata;
      beforeEach(async () => {
        await deployerVerificationCouponClient.mint({
          toAddress: primaryAddress,
          expirationTime,
          quantity: 1,
          ownerDid,
        });
      });

      const credentialData = {
        credentialType: defaultCredentialType,
        contentHash: {
          value: password,
        },
      };
      const freeCredentialData = {
        credentialType: freeCredentialTypesList[0],
        contentHash: {
          value: password,
        },
      };
      it('Retrieve credential metadata with multi did', async () => {
        const indexEntries = [
          { accountId: primaryAddress, listId: '1', index: '1' },
          { accountId: primaryAddress, listId: '1', index: '2' },
          { accountId: primaryAddress, listId: '1', index: '3' },
        ];

        const entries =
          await operatorMetadataRegistryClient.resolveContractEntries({
            credentials: [credentialData, credentialData],
            indexEntries,
            traceId,
            caoDid,
            burnerDid,
          });
        const entriesJson = map(
          (entry) => JSON.parse(JSON.stringify(entry)),
          entries,
        );
        expect(entriesJson).toEqual(expectedEntries);
      });

      it('Retrieve credential metadata with multi did with only free types', async () => {
        const indexEntries = [
          { accountId: primaryAddress, listId: '1', index: '2' },
          { accountId: primaryAddress, listId: '1', index: '2' },
        ];

        const entries =
          await operatorMetadataRegistryClient.resolveContractEntries({
            credentials: [freeCredentialData],
            indexEntries,
            traceId,
            caoDid,
            burnerDid,
          });
        entries.map((entry) =>
          expect(JSON.parse(JSON.stringify(entry))).toEqual(expectedEntries[1]),
        );
      });

      it('Retrieve credential metadata fails on uncompleted did', async () => {
        const result =
          await operatorMetadataRegistryClient.resolveContractEntries({
            credentials: [credentialData, credentialData],
            indexEntries: [],
            traceId,
            caoDid,
          });
        await expect(result).toEqual([]);
      });
    });

    [
      {
        listId: 3,
        didSuffix: null,
        resolveWithSuffix: false,
        title: 'without a didSuffix',
      },
      {
        listId: 5,
        didSuffix: password,
        resolveWithSuffix: false,
        title: 'using a didSuffix, but not for resolution',
      },
      {
        listId: 6,
        didSuffix: password,
        resolveWithSuffix: true,
        title: 'using a didSuffix',
      },
    ].forEach(({ listId, didSuffix, resolveWithSuffix, title }) => {
      describe(`Resolve DID ${title} from legacy credential metadata entry`, () => {
        let credential;
        let indexEntry;
        const index = 2342;
        const { publicKey } = generateKeyPair({ format: 'jwk' });
        const credentialMetadata = {
          listId,
          index,
          publicKey,
          credentialTypeEncoded: get2BytesHash(defaultCredentialType),
        };

        before(async () => {
          indexEntry = [primaryAddress, listId, index, didSuffix];
          credential = {
            id: buildDid(indexEntry),
            credentialType: defaultCredentialType,
          };
          if (didSuffix == null || !resolveWithSuffix) {
            credential.contentHash = password;
          }
          if (!resolveWithSuffix) {
            indexEntry = indexEntry.slice(0, -1);
          }

          await operatorMetadataRegistryClient.createCredentialMetadataList(
            primaryAddress,
            listId,
            vc,
            caoDid,
          );
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            credentialMetadata,
            password,
            caoDid,
          );
        });
        beforeEach(async () => {
          await deployerVerificationCouponClient.mint({
            toAddress: primaryAddress,
            expirationTime,
            quantity: 1,
            ownerDid,
          });
        });

        it('Create and resolve did', async () => {
          const didDocument =
            await operatorMetadataRegistryClient.resolveDidDocument({
              did: buildDid(indexEntry),
              credentials: [credential],
              burnerDid,
              caoDid: 'did:velocity:99',
            });

          expect(didDocument).toEqual({
            didDocument: {
              id: didValidation,
              publicKey: [publicKeyValidation],
              service: [serviceValidation],
            },
            didDocumentMetadata: {
              boundIssuerVcs: [boundIssuerVcsValidation],
            },
            didResolutionMetadata: {},
          });
        });

        it('Create and resolve multi did', async () => {
          const indexEntries = [indexEntry, indexEntry];
          const did = buildMultiDid(indexEntries);
          const didDocument =
            await operatorMetadataRegistryClient.resolveDidDocument({
              did,
              credentials: [credential, credential],
              burnerDid,
              caoDid: 'did:velocity:99',
            });
          const multiDidDocumentValidation = {
            didDocument: {
              id: didValidation,
              publicKey: [publicKeyValidation, publicKeyValidation],
              service: [serviceValidation, serviceValidation],
            },
            didDocumentMetadata: {
              boundIssuerVcs: [
                boundIssuerVcsValidation,
                boundIssuerVcsValidation,
              ],
            },
            didResolutionMetadata: {},
          };
          expect(didDocument).toEqual(multiDidDocumentValidation);
        });

        it('Should return did resolution metadata if wrong resolved', async () => {
          const badContentHash = '1111111111111111111111111111111111111111';
          const badIndexEntry = [
            primaryAddress,
            listId,
            2342,
            didSuffix == null || !resolveWithSuffix ? null : badContentHash,
          ];
          const badCredential = {
            id: buildDid(badIndexEntry),
            credentialType: defaultCredentialType,
          };
          if (didSuffix == null || !resolveWithSuffix) {
            badCredential.contentHash = badContentHash;
          }
          const didDocument =
            await operatorMetadataRegistryClient.resolveDidDocument({
              did: buildMultiDid([badIndexEntry]),
              credentials: [badCredential],
              burnerDid,
              caoDid: 'did:velocity:99',
            });

          expect(didDocument).toEqual({
            didDocument: {
              id: didValidation,
              publicKey: [],
              service: [serviceValidation],
            },
            didDocumentMetadata: {
              boundIssuerVcs: [boundIssuerVcsValidation],
            },
            didResolutionMetadata: {
              error: 'UNRESOLVED_MULTI_DID_ENTRIES',
              unresolvedMultiDidEntries: [
                {
                  id: didValidation,
                  error: 'DATA_INTEGRITY_ERROR',
                },
              ],
            },
          });
        });

        it('Unsupported encryption algorithm and version to resolve multi did', async () => {
          const badIndexEntry = [primaryAddress, listId + 8, 1, didSuffix];
          await operatorMetadataRegistryClient.createCredentialMetadataList(
            primaryAddress,
            badIndexEntry[1],
            vc,
            caoDid,
            'unsupported algorithm',
            '1',
          );
          await operatorMetadataRegistryClient.setEntrySigned(
            regularIssuingCredentialTypeHash,
            bytes,
            badIndexEntry[1],
            badIndexEntry[2],
            traceId,
            caoDid,
          );
          const credentialData = {
            id: buildDid(
              resolveWithSuffix ? badIndexEntry : badIndexEntry.slice(0, -1),
            ),
            credentialType: regularIssuingCredentialType,
          };
          if (didSuffix == null || !resolveWithSuffix) {
            credentialData.contentHash = password;
          }

          const did = buildMultiDid([badIndexEntry]);
          const result = operatorMetadataRegistryClient.resolveDidDocument({
            did,
            credentials: [credentialData],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

          await expect(result).rejects.toThrow(
            'Unsupported algorithm (0x682d). Valid values are aes-256-gcm (0xa38d) or cosekey:aes-256-gcm (0xd19a)',
          );
        });

        it('Invalid hash credentialType wrong type resolve did', async () => {
          const badCredential = {
            ...credential,
            credentialType: 'Wrong type!',
          };
          const result = operatorMetadataRegistryClient.resolveDidDocument({
            did: buildDid(indexEntry),
            credentials: [badCredential],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

          await expect(result).rejects.toThrow(
            'Invalid hash credentialType "Wrong type!"',
          );
        });
        it('Missed credential type field in VC', async () => {
          const badCredential = {
            ...credential,
            credentialType: null,
          };
          const result = operatorMetadataRegistryClient.resolveDidDocument({
            did: buildDid(indexEntry),
            credentials: [badCredential],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

          await expect(result).rejects.toThrow(
            `Could not resolve credential type from VC with ${badCredential.id}`,
          );
        });

        it('Missed content hash field in VC', async () => {
          const badCredential = omit(['contentHash'], credential);
          if (credential.contentHash == null) {
            return;
          }
          const result = operatorMetadataRegistryClient.resolveDidDocument({
            did: buildDid(indexEntry),
            credentials: [badCredential],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

          await expect(result).rejects.toThrow(
            `Could not resolve content hash from VC with ${badCredential.id}`,
          );
        });
      });
    });

    describe('Resolve DID with didSuffix from COSE key credential metadata entry', () => {
      let credentialIds;

      const keyPairs = [
        generateJWAKeyPair({ algorithm: 'ec', curve: 'secp256k1' }),
        generateJWAKeyPair({ algorithm: 'ec', curve: 'P-256' }),
        generateJWAKeyPair({ algorithm: 'rsa' }),
      ];

      const credentialMetadatas = mapWithIndex(
        (keyPair, i) => ({
          listId: 3004,
          index: 2342 + i,
          publicKey: keyPair.publicKey,
          credentialTypeEncoded: get2BytesHash(defaultCredentialType),
        }),
        keyPairs,
      );

      before(async () => {
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          first(credentialMetadatas).listId,
          vc,
          caoDid,
          ALG_TYPE.COSEKEY_AES_256,
        );
        credentialIds = map(
          (credentialMetadata) =>
            `did:velocity:v2:${primaryAddress}:${credentialMetadata.listId}:${credentialMetadata.index}:${password}`,
          credentialMetadatas,
        );

        for (const credentialMetadata of credentialMetadatas) {
          // eslint-disable-next-line no-await-in-loop
          await operatorMetadataRegistryClient.addCredentialMetadataEntry(
            credentialMetadata,
            password,
            caoDid,
            ALG_TYPE.COSEKEY_AES_256,
          );
        }
      });
      beforeEach(async () => {
        await deployerVerificationCouponClient.mint({
          toAddress: primaryAddress,
          expirationTime,
          quantity: 1,
          ownerDid,
        });
      });

      it('Create and resolve did', async () => {
        const credential = {
          id: first(credentialIds),
          credentialType: defaultCredentialType,
        };
        const didDocument =
          await operatorMetadataRegistryClient.resolveDidDocument({
            did: first(credentialIds),
            credentials: [credential],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

        expect(didDocument).toEqual({
          didDocument: {
            id: didValidation,
            publicKey: [expectedPublicKey(first(keyPairs))],
            service: [serviceValidation],
          },
          didDocumentMetadata: {
            boundIssuerVcs: [boundIssuerVcsValidation],
          },
          didResolutionMetadata: {},
        });
      });

      it('Create and resolve multi did', async () => {
        const credentialDatas = map(
          (id) => ({
            id,
            credentialType: defaultCredentialType,
          }),
          credentialIds,
        );
        const indexEntries = [
          [
            primaryAddress,
            credentialMetadatas[0].listId,
            credentialMetadatas[0].index,
            password,
          ],
          [
            primaryAddress,
            credentialMetadatas[1].listId,
            credentialMetadatas[1].index,
            password,
          ],
          [
            primaryAddress,
            credentialMetadatas[2].listId,
            credentialMetadatas[2].index,
            password,
          ],
        ];
        const did = buildMultiDid(indexEntries);
        const didDocument =
          await operatorMetadataRegistryClient.resolveDidDocument({
            did,
            credentials: credentialDatas,
            burnerDid,
            caoDid: 'did:velocity:99',
          });
        const multiDidDocumentValidation = {
          didDocument: {
            id: didValidation,
            publicKey: [
              expectedPublicKey(keyPairs[0]),
              expectedPublicKey(keyPairs[1]),
              expectedPublicKey(keyPairs[2]),
            ],
            service: [serviceValidation, serviceValidation, serviceValidation],
          },
          didDocumentMetadata: {
            boundIssuerVcs: [
              boundIssuerVcsValidation,
              boundIssuerVcsValidation,
              boundIssuerVcsValidation,
            ],
          },
          didResolutionMetadata: {},
        };
        expect(didDocument).toEqual(multiDidDocumentValidation);
      });

      it('Should return did resolution metadata if wrong resolved', async () => {
        const entryIndexes = [
          [
            primaryAddress,
            credentialMetadatas[0].listId,
            2342,
            '1111111111111111111111111111111111111111111111111111111111111111',
          ],
        ];
        const did = entryIndexes.reduce(
          (multiDid, [accountId, listId, index, pass], i) =>
            !i
              ? `${multiDid}:${accountId}:${listId}:${index}:${pass}`
              : `${multiDid};${accountId}:${listId}:${index}:${pass}`,
          'did:velocity:v2:multi',
        );
        const credential = {
          id: `did:velocity:v2:${entryIndexes[0][0]}:${entryIndexes[0][1]}:${entryIndexes[0][2]}:${entryIndexes[0][3]}`,
          credentialType: defaultCredentialType,
        };
        const didDocument =
          await operatorMetadataRegistryClient.resolveDidDocument({
            did,
            credentials: [credential],
            burnerDid,
            caoDid: 'did:velocity:99',
          });

        expect(didDocument).toEqual({
          didDocument: {
            id: didValidation,
            publicKey: [],
            service: [serviceValidation],
          },
          didDocumentMetadata: {
            boundIssuerVcs: [boundIssuerVcsValidation],
          },
          didResolutionMetadata: {
            error: 'UNRESOLVED_MULTI_DID_ENTRIES',
            unresolvedMultiDidEntries: [
              {
                id: didValidation,
                error: 'DATA_INTEGRITY_ERROR',
              },
            ],
          },
        });
      });

      it('Unsupported encryption algorithm and version to resolve multi did', async () => {
        const listId = 11;
        await operatorMetadataRegistryClient.createCredentialMetadataList(
          primaryAddress,
          listId,
          vc,
          caoDid,
          'unsupported algorithm',
          '1',
        );
        await operatorMetadataRegistryClient.addCredentialMetadataEntry(
          { ...credentialMetadatas[0], listId },
          password,
          caoDid,
          ALG_TYPE.COSEKEY_AES_256,
        );

        const credentialData = {
          id: `did:velocity:v2:${primaryAddress}:${listId}:${credentialMetadatas[0].index}:${password}`,
          credentialType: regularIssuingCredentialType,
        };
        const indexEntries = [
          [primaryAddress, listId, credentialMetadatas[0].index, password],
        ];
        const did = buildMultiDid(indexEntries);
        const result = operatorMetadataRegistryClient.resolveDidDocument({
          did,
          credentials: [credentialData],
          burnerDid,
          caoDid: 'did:velocity:99',
        });

        await expect(result).rejects.toThrow(
          'Unsupported algorithm (0x682d). Valid values are aes-256-gcm (0xa38d) or cosekey:aes-256-gcm (0xd19a)',
        );
      });

      it('Invalid hash credentialType wrong type resolve did', async () => {
        const credential = {
          id: credentialIds[0],
          credentialType: 'Wrong type!',
        };
        const result = operatorMetadataRegistryClient.resolveDidDocument({
          did: credentialIds[0],
          credentials: [credential],
          burnerDid,
          caoDid: 'did:velocity:99',
        });

        await expect(result).rejects.toThrow(
          'Invalid hash credentialType "Wrong type!"',
        );
      });
      it('Missed credential type field in VC', async () => {
        const credential = {
          id: credentialIds[0],
          credentialType: null,
        };
        const result = operatorMetadataRegistryClient.resolveDidDocument({
          did: credentialIds[0],
          credentials: [credential],
          burnerDid,
          caoDid: 'did:velocity:99',
        });

        await expect(result).rejects.toThrow(
          `Could not resolve credential type from VC with ${credentialIds[0]}`,
        );
      });

      it('Missed content hash field in VC', async () => {
        const did = credentialIds[0].split(':').slice(0, -1).join(':');
        const credential = {
          id: did,
          credentialType: defaultCredentialType,
        };
        const result = operatorMetadataRegistryClient.resolveDidDocument({
          did,
          credentials: [credential],
          burnerDid,
          caoDid: 'did:velocity:99',
        });

        await expect(result).rejects.toThrow(
          `Could not resolve content hash from VC with ${did}`,
        );
      });
    });

    describe('Pull Metadata Registry Events', () => {
      it('Should pull CreatedMetadataList event', async () => {
        const result =
          await operatorMetadataRegistryClient.pullCreatedMetadataListEvents();
        expect(result).toEqual({
          eventsCursor: expect.any(Function),
          latestBlock: expect.any(Number),
        });
        let aggregateArrayOfEvents = [];
        for await (const eventsSet of result.eventsCursor()) {
          aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
        }
        expect(aggregateArrayOfEvents[0].args.sender.toLowerCase()).toEqual(
          primaryAddress.toLowerCase(),
        );

        expect(aggregateArrayOfEvents[0].args.issuerVc).toEqual(bytes2);
        expect(aggregateArrayOfEvents[0].args.sender.toLowerCase()).toEqual(
          primaryAddress.toLowerCase(),
        );
        expect(aggregateArrayOfEvents[0].fragment.name).toEqual(
          'CreatedMetadataList',
        );
      });

      it('Should pull AddedCredentialMetadata event', async () => {
        const result =
          await operatorMetadataRegistryClient.pullAddedCredentialMetadataEvents();
        expect(result).toEqual({
          eventsCursor: expect.any(Function),
          latestBlock: expect.any(Number),
        });
        let aggregateArrayOfEvents = [];
        for await (const eventsSet of result.eventsCursor()) {
          aggregateArrayOfEvents = aggregateArrayOfEvents.concat(eventsSet);
        }
        expect(aggregateArrayOfEvents[0].args.sender.toLowerCase()).toEqual(
          primaryAddress.toLowerCase(),
        );
        expect(aggregateArrayOfEvents[0].args.issuerVc).toEqual(bytes2);
        expect(aggregateArrayOfEvents[0].fragment.name).toEqual(
          'AddedCredentialMetadata',
        );
      });
    });
  });
});

const expectedEntries = [sampleEntry, sampleEntryFree, sampleEntryContactFree];

const buildDid = (indexEntry, prefix = 'did:velocity:v2:') =>
  `${prefix}${compact(indexEntry).join(':')}`;

const buildMultiDid = (indexEntries, didPrefix = 'did:velocity:v2:multi:') =>
  reduce(
    (multiDid, indexEntry) => `${buildDid(indexEntry, multiDid)};`,
    didPrefix,
    indexEntries,
  ).slice(0, -1);

const didValidation = expect.stringMatching(/^did:velocity:v2:/);
const publicKeyValidation = {
  id: expect.stringMatching(/^did:velocity:v2:.*#key-1$/),
  publicKeyJwk: {
    crv: 'secp256k1',
    x: expect.any(String),
    y: expect.any(String),
    kty: 'EC',
    use: 'sig',
  },
};

const serviceValidation = {
  id: didValidation,
  credentialType: defaultCredentialType,
};
const boundIssuerVcsValidation = {
  id: didValidation,
  format: 'jwt_vc',
  vc: expect.any(String),
};

const expectedPublicKey = (keyPair) => ({
  id: expect.stringMatching(/^did:velocity:v2:.*#key-1$/),
  publicKeyJwk: keyPair.publicKey,
});
