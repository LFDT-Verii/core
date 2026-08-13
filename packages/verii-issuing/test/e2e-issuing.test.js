/*
 * Copyright 2024 Velocity Team
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
 *
 */

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const console = require('console');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');
const {
  deployPermissionContract,
  deployVerificationCouponContract,
  deployMetadataContract,
  deployRevocationContract,
  deployerPrivateKey,
  rpcProvider,
} = require('@verii/metadata-registration/test/helpers/deploy-contracts');
const { initMetadataRegistry } = require('@verii/metadata-registration');

const { nanoid } = require('nanoid');
const { hexFromJwk, KeyAlgorithms } = require('@verii/crypto');
const { jwtDecode, jwtSign, jwtVerify } = require('@verii/jwt');
const { MongoClient } = require('mongodb');
const { map } = require('lodash/fp');
const { collectionClient } = require('./helpers/collection-client');
const { entityFactory } = require('./helpers/entity-factory');

const freeCredentialTypesList = ['EmailV1.0', 'DrivingLicenseV1.0'];

const { offerFactory } = require('./helpers/offer-factory');
const { createExampleDid } = require('./helpers/create-example-did');
const { issueVeriiCredentials } = require('../src/issue-verii-credentials');
const { credentialTypesMap } = require('./helpers/credential-types-map');
const { jwtVcExpectation } = require('./helpers/jwt-vc-expectation');
const {
  mongoAllocationListQueries,
} = require('../src/adapters/mongo-allocation-list-queries');

describe('E2E issuing', { timeout: 60000 }, () => {
  const mongoClient = new MongoClient('mongodb://localhost:27017/');

  const repos = {};

  let context;
  let issuerEntity;
  let caoEntity;
  let issuer;

  let revocationContractAddress;
  let metadataRegistryContractAddress;

  before(async () => {
    await mongoFactoryWrapper('test-metadata-registry', context);
    repos.allocations = await collectionClient({
      mongoClient,
      name: 'allocations',
    });

    context = buildContext({
      repos,
    });

    issuerEntity = entityFactory({ service: [{ id: '#issuer-1' }] });
    caoEntity = entityFactory({ service: [{ id: '#cao-1' }] });
    issuer = {
      id: nanoid(),
      did: issuerEntity.did,
      issuingRefreshServiceId: issuerEntity.service[1]?.id,
      issuingServiceKMSKeyId: issuerEntity.key[0].id,
      issuingServiceDIDKeyId: issuerEntity.key[0].id,
      dltOperatorAddress: toEthereumAddress(issuerEntity.keyPair.publicKey),
      dltOperatorKMSKeyId: issuerEntity.key[0].id,
      dltPrimaryAddress: issuerEntity.primaryAddress,
    };

    const permissionsAddress = await deployPermissionContract();
    const verificationCouponAddress = await deployVerificationCouponContract(
      permissionsAddress,
      context,
    );
    revocationContractAddress = await deployRevocationContract(
      permissionsAddress,
      context,
    );
    metadataRegistryContractAddress = await deployMetadataContract(
      freeCredentialTypesList,
      verificationCouponAddress,
      permissionsAddress,
      context,
    );

    const deployerPermissionsClient = await initPermissions(
      {
        privateKey: deployerPrivateKey,
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      context,
    );
    await deployerPermissionsClient.addAddressScope({
      address: metadataRegistryContractAddress,
      scope: 'coupon:burn',
    });
    await deployerPermissionsClient.addPrimary({
      primary: issuer.dltPrimaryAddress,
      permissioning: issuer.dltPrimaryAddress,
      rotation: issuer.dltPrimaryAddress,
    });
    await deployerPermissionsClient.addAddressScope({
      address: issuer.dltPrimaryAddress,
      scope: 'transactions:write',
    });
    await deployerPermissionsClient.addAddressScope({
      address: issuer.dltPrimaryAddress,
      scope: 'credential:issue',
    });
    await deployerPermissionsClient.addAddressScope({
      address: issuer.dltPrimaryAddress,
      scope: 'credential:contactissue',
    });
    const operatorPermissionsClient = await initPermissions(
      {
        privateKey: hexFromJwk(issuerEntity.keyPair.privateKey, true),
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      context,
    );
    await operatorPermissionsClient.addOperatorKey({
      primary: issuer.dltPrimaryAddress,
      operator: issuer.dltOperatorAddress,
    });
  });

  after(async () => {
    await mongoCloseWrapper();
    await mongoClient.close();
  });

  beforeEach(async () => {
    await repos.allocations.deleteMany();
    context = buildContext({
      issuerEntity,
      caoEntity,
      revocationContractAddress,
      metadataRegistryContractAddress,
      allocationListQueries: mongoAllocationListQueries(
        mongoClient.db('test-collections'),
        'allocations',
      ),
      rpcProvider,
    });
  });

  it('should create vcs with ES256, RS256, and SECP256K1 metadata', async () => {
    const offers = map(offerFactory, [
      { issuerId: issuerEntity.did }, // default email credential
      {
        type: ['OpenBadgeCredential'],
        name: 'Velocity Network Board Member 2022',
        validFrom: '2022-12-31T00:00:00Z',
        issuer: { type: ['Profile'], id: issuerEntity.did },
        credentialSubject: {
          type: ['AchievementSubject'],
          achievement: {
            type: ['Achievement'],
            id: 'mailto:conformance@imsglobal.org',
            identifier: {
              type: ['IdentifierEntry'],
              identityType: 'emailAddress',
              identityHash: 'conformance@imsglobal.org',
            },
          },
        },
      },
      {
        type: 'EmploymentCurrentV1.1',
        issuerId: issuerEntity.did,
        credentialSubject: {
          role: 'Software Developer',
          legalEmployer: {
            name: 'ACME Corporation',
          },
          startDate: '2022-04-01',
        },
      },
    ]);
    const userId = createExampleDid();
    const credentials = await issueVeriiCredentials(
      offers,
      userId,
      credentialTypesMap,
      issuer,
      context,
      [KeyAlgorithms.ES256],
    );

    expect(credentials.length).toEqual(offers.length);
    expect(jwtDecode(credentials[0]).header.alg).toEqual('ES256');
    for (let i = 0; i < credentials.length; i += 1) {
      const jwtVc = jwtDecode(credentials[i]);

      jwtVcExpectation({
        issuerEntity,
        offer: offers[i],
        credentialId: jwtVc.payload.jti,
        userId,
      });
    }
  });

  it('preserves ES256K and RS256 issue, anchor, resolution, and verification', async () => {
    for (const algorithm of [KeyAlgorithms.SECP256K1, KeyAlgorithms.RS256]) {
      // eslint-disable-next-line no-await-in-loop
      await issueResolveAndVerify(algorithm, {
        context,
        issuer,
        issuerEntity,
      });
    }
  });

  it('supports ES256 issue, anchor, resolution, and verification', async () => {
    await issueResolveAndVerify(KeyAlgorithms.ES256, {
      context,
      issuer,
      issuerEntity,
    });
  });
});

const issueResolveAndVerify = async (
  algorithm,
  { context, issuer, issuerEntity },
) => {
  const offer = offerFactory({
    credentialType: 'EmailV1.0',
    issuerId: issuerEntity.did,
  });
  const [credential] = await issueVeriiCredentials(
    [offer],
    createExampleDid(),
    credentialTypesMap,
    issuer,
    context,
    [algorithm],
  );
  const { header, payload } = jwtDecode(credential);
  const metadataRegistry = await initMetadataRegistry(
    {
      contractAddress: context.config.metadataRegistryContractAddress,
      privateKey: issuerEntity.keyPair.privateKey,
      rpcProvider: context.rpcProvider,
    },
    context,
  );
  const { didDocument, didResolutionMetadata } =
    await metadataRegistry.resolveDidDocument({
      burnerDid: issuer.did,
      caoDid: context.caoDid,
      credentials: [
        {
          contentHash: payload.vc.contentHash.value,
          credentialType: 'EmailV1.0',
          id: payload.jti,
        },
      ],
      did: payload.jti,
    });
  const [{ id, publicKeyJwk }] = didDocument.publicKey;

  expect(didResolutionMetadata).toEqual({});
  expect(header).toEqual(
    expect.objectContaining({
      alg: algorithm === KeyAlgorithms.SECP256K1 ? 'ES256K' : algorithm,
      kid: id,
    }),
  );
  expect(publicKeyJwk).toEqual(
    expect.objectContaining(getPublicKeyExpectation(algorithm)),
  );
  await expect(jwtVerify(credential, publicKeyJwk, false)).resolves.toEqual(
    expect.objectContaining({ header }),
  );
};

const getPublicKeyExpectation = (algorithm) => {
  if (algorithm === KeyAlgorithms.SECP256K1) {
    return { crv: 'secp256k1', kty: 'EC' };
  }
  if (algorithm === KeyAlgorithms.ES256) {
    return { crv: 'P-256', kty: 'EC' };
  }
  return { kty: 'RSA' };
};

const buildContext = ({
  issuerEntity,
  caoEntity,
  db,
  revocationContractAddress = '0x1234',
  metadataRegistryContractAddress = '0x01',
  ...args
}) => ({
  kms: {
    exportKeyOrSecret: (keyId) => {
      const issuerKeyId = issuerEntity.key[0].id;
      if (keyId !== issuerKeyId) {
        throw new Error('KeyNotFound');
      }
      return Promise.resolve({
        privateJwk: issuerEntity.keyPair.privateKey,
        id: issuerKeyId,
      });
    },
    async signJwt(jwtJson, keyId, headers) {
      const key = await this.exportKeyOrSecret(keyId);
      return jwtSign(jwtJson, key.privateJwk, headers);
    },
  },
  caoDid: caoEntity?.did,
  config: {
    revocationContractAddress,
    metadataRegistryContractAddress,
    credentialExtensionsContextUrl:
      'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
  },
  db,
  log: console,
  traceId: nanoid(),
  ...args,
});
