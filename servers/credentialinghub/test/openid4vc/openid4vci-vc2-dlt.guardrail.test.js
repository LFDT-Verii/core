/**
 * Copyright 2026 Velocity Team
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

const { after, before, beforeEach, describe, it } = require('node:test');
const console = require('node:console');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { buildMongoConnection } = require('@verii/tests-helpers');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');
const { generateKeyPair, hexFromJwk, KeyAlgorithms } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { jwtDecode, jwtSign } = require('@verii/jwt');
const { initMetadataRegistry } = require('@verii/metadata-registration');
const {
  deployMetadataContract,
  deployPermissionContract,
  deployRevocationContract,
  deployVerificationCouponContract,
  deployerPrivateKey,
  rpcProvider,
} = require('@verii/metadata-registration/test/helpers/deploy-contracts');
const { nanoid } = require('nanoid');
const { initCredentialFactory } = require('../../src/entities/credentials');
const { initDepotFactory } = require('../../src/entities/depots');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  openBadgeCredentialContent,
} = require('../helpers/build-open-badge-credential');
const { constructTenant } = require('../helpers/construct-tenant');
const createTestFastify = require('../helpers/create-test-fastify');

const expectedV2Context = 'https://www.w3.org/ns/credentials/v2';
const freeCredentialTypes = ['Employment', 'OpenBadgeCredential'];

describe('OpenID4VCI VC 2.0 real-DLT guardrails', { timeout: 120000 }, () => {
  let fastify;
  let issuerKeyPair;
  let persistCredential;
  let persistDepot;
  let persistIssuerService;
  let persistKey;
  let persistTenant;
  let tenant;

  before(async () => {
    const deploymentContext = {
      log: console,
      traceId: nanoid(),
    };
    const permissionsContractAddress = await deployPermissionContract();
    const verificationCouponContractAddress =
      await deployVerificationCouponContract(
        permissionsContractAddress,
        deploymentContext,
      );
    const revocationContractAddress = await deployRevocationContract(
      permissionsContractAddress,
      deploymentContext,
    );
    const metadataRegistryContractAddress = await deployMetadataContract(
      freeCredentialTypes,
      verificationCouponContractAddress,
      permissionsContractAddress,
      deploymentContext,
    );

    fastify = createTestFastify({
      couponContractAddress: verificationCouponContractAddress,
      metadataRegistryContractAddress,
      mongoConnection: buildMongoConnection('test-cih-blmp-3-3-dlt'),
      permissionsContractAddress,
      revocationContractAddress,
      rpcUrl: 'http://localhost:8545',
    });
    await fastify.ready();
    ({ persistCredential } = initCredentialFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));

    await clearCollections();

    const primaryKeyPair = generateKeyPair({ format: 'jwk' });
    const primaryAddress = toEthereumAddress(primaryKeyPair.publicKey);
    ({ issuerKeyPair, tenant } = await constructTenant(
      persistTenant,
      persistKey,
      { primaryAccount: primaryAddress },
    ));

    const deployerPermissionsClient = await initPermissions(
      {
        contractAddress: permissionsContractAddress,
        privateKey: deployerPrivateKey,
        rpcProvider,
      },
      deploymentContext,
    );
    await deployerPermissionsClient.addAddressScope({
      address: metadataRegistryContractAddress,
      scope: 'coupon:burn',
    });
    await deployerPermissionsClient.addPrimary({
      permissioning: primaryAddress,
      primary: primaryAddress,
      rotation: primaryAddress,
    });
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
      scope: 'credential:contactissue',
    });

    const primaryPermissionsClient = await initPermissions(
      {
        contractAddress: permissionsContractAddress,
        privateKey: hexFromJwk(primaryKeyPair.privateKey, true),
        rpcProvider,
      },
      deploymentContext,
    );
    await primaryPermissionsClient.addOperatorKey({
      operator: toEthereumAddress(
        tenant.keysByPurpose.DLT_TRANSACTIONS.publicJwk,
      ),
      primary: primaryAddress,
    });
  });

  beforeEach(async () => {
    await Promise.all(
      [
        'allocations',
        'credentials',
        'depots',
        'exchanges',
        'issuerServices',
        'notification_events',
        'notifications',
      ].map((collection) => mongoDb().collection(collection).deleteMany({})),
    );
    await mongoDb()
      .collection('tenants')
      .updateOne(
        { _id: new ObjectId(tenant._id) },
        { $unset: { credentialSigningAlgorithm: '' } },
      );
  });

  after(async () => fastify?.close());

  const cases = [
    {
      expectedJoseAlgorithm: 'ES256K',
      expectedKey: { crv: 'secp256k1', kty: 'EC' },
      signingAlgorithm: KeyAlgorithms.SECP256K1,
    },
    {
      expectedJoseAlgorithm: 'ES256',
      expectedKey: { crv: 'P-256', kty: 'EC' },
      signingAlgorithm: KeyAlgorithms.ES256,
      tenantOverride: KeyAlgorithms.ES256,
    },
    {
      expectedJoseAlgorithm: 'RS256',
      expectedKey: { kty: 'RSA' },
      signingAlgorithm: KeyAlgorithms.RS256,
      tenantOverride: KeyAlgorithms.RS256,
    },
    {
      badge: true,
      expectedJoseAlgorithm: 'ES256',
      expectedKey: { crv: 'P-256', kty: 'EC' },
      signingAlgorithm: KeyAlgorithms.ES256,
      tenantOverride: KeyAlgorithms.ES256,
    },
    {
      badge: true,
      expectedJoseAlgorithm: 'RS256',
      expectedKey: { kty: 'RSA' },
      signingAlgorithm: KeyAlgorithms.RS256,
    },
  ];

  it('[characterization] preserves the immediate credential response and accepted-notification state transition', async () => {
    const result = await issueAndAcceptCredential({});

    expect(
      result.storedCredential.exchange.events.map(({ state }) => state),
    ).toEqual(['NEW', 'CREDENTIALS_SIGNED', 'COMPLETE']);
    expect(result.storedCredential.exchange).not.toEqual(
      expect.objectContaining({ transactionId: expect.anything() }),
    );
  });

  for (const testCase of cases) {
    const badgeLabel = testCase.badge ? ' Open Badge' : '';
    const policyLabel =
      testCase.badge && testCase.tenantOverride == null ? ' type default' : '';

    it(`[expected-red] issues a direct v2${badgeLabel} using ${testCase.expectedJoseAlgorithm}${policyLabel}`, async () => {
      const result = await issueAndAcceptCredential(testCase);

      expect(result.header).toEqual({
        alg: testCase.expectedJoseAlgorithm,
        cty: 'vc',
        kid: expect.stringMatching(/^did:velocity:v2:.+#key-1$/),
        typ: 'vc+jwt',
      });
      expect(result.header.kid).toEqual(`${result.payload.id}#key-1`);
      expect(result.payload['@context'][0]).toEqual(expectedV2Context);
      expect(result.payload).not.toEqual(
        expect.objectContaining({
          exp: expect.anything(),
          iss: expect.anything(),
          jti: expect.anything(),
          nbf: expect.anything(),
          sub: expect.anything(),
          vc: expect.anything(),
          vp: expect.anything(),
        }),
      );
      expect(result.resolvedPublicKey).toEqual(
        expect.objectContaining(testCase.expectedKey),
      );
      expect(result.storedCredential).toEqual(
        expect.objectContaining({
          dataModelVersion: '2.0',
          envelopeFormat: 'vc+jwt',
          signingAlgorithm: testCase.signingAlgorithm,
        }),
      );
    });
  }

  it('rejects the legacy OpenID credential profile with a stable client error', async () => {
    const setup = await setupCredential({});
    const proof = await buildProof(setup.holderDid, setup.holderKeyPair);
    const response = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      headers: { authorization: `Bearer ${setup.authToken}` },
      payload: {
        credential_identifier: setup.credential._id,
        format: 'jwt_vc_json-ld',
        proofs: { jwt: [proof] },
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual({
      error: 'invalid_credential_request',
      error_description: 'Unsupported credential format jwt_vc_json-ld',
    });
  });

  const issueAndAcceptCredential = async (testCase) => {
    const setup = await setupCredential(testCase);
    const nonceResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/nonce`,
    });
    expect(nonceResponse.statusCode).toEqual(200);
    expect(nonceResponse.headers['cache-control']).toEqual('no-store');
    expect(nonceResponse.json).toEqual({ c_nonce: expect.any(String) });
    const proof = await buildProof(
      setup.holderDid,
      setup.holderKeyPair,
      nonceResponse.json.c_nonce,
    );
    const response = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      headers: { authorization: `Bearer ${setup.authToken}` },
      payload: {
        credential_identifier: setup.credential._id,
        format: 'application/vc+jwt',
        proofs: { jwt: [proof] },
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      credentials: [{ credential: expect.any(String) }],
      notification_id: expect.any(String),
    });

    const compactCredential = response.json.credentials[0].credential;
    const { header, payload } = jwtDecode(compactCredential);
    const credentialId = payload.id ?? payload.jti ?? payload.vc?.id;

    const notificationResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/notification`,
      headers: { authorization: `Bearer ${setup.authToken}` },
      payload: {
        event: 'credential_accepted',
        notification_id: response.json.notification_id,
      },
    });
    expect(notificationResponse.statusCode).toEqual(204);

    const storedCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(setup.credential._id) });
    expect(storedCredential).toEqual(
      expect.objectContaining({
        acceptedAt: expect.any(Date),
        jwtVc: compactCredential,
      }),
    );

    const metadataRegistry = await initMetadataRegistry(
      {
        contractAddress: fastify.config.metadataRegistryContractAddress,
        privateKey: issuerKeyPair.privateKey,
        rpcProvider,
      },
      { log: console, traceId: nanoid() },
    );
    const { didDocument, didResolutionMetadata } =
      await metadataRegistry.resolveDidDocument({
        burnerDid: tenant.did,
        caoDid: tenant.caoDid,
        credentials: [
          {
            contentHash:
              storedCredential.exchange.credentialMetadata.contentHash,
            credentialType:
              storedCredential.exchange.credentialMetadata.credentialType,
            id: credentialId,
          },
        ],
        did: credentialId,
      });
    expect(didResolutionMetadata).toEqual({});

    return {
      header,
      payload,
      resolvedPublicKey: didDocument.publicKey[0].publicKeyJwk,
      storedCredential,
    };
  };

  const setupCredential = async ({ badge = false, tenantOverride } = {}) => {
    if (tenantOverride != null) {
      await mongoDb()
        .collection('tenants')
        .updateOne(
          { _id: new ObjectId(tenant._id) },
          { $set: { credentialSigningAlgorithm: tenantOverride } },
        );
    }

    const { content, typeMetadata } = getCredentialInput(badge);
    const issuerService = await persistIssuerService({ tenant });
    const depot = await persistDepot({ service: issuerService, tenant });
    const credential = await persistCredential({
      content,
      depot,
      tenant,
      typeMetadata,
    });
    const holderKeyPair = generateKeyPair({ format: 'jwk' });
    const holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
    const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
      subject: `https://localhost.test/r/${tenant._id}`,
    });

    return { authToken, credential, holderDid, holderKeyPair };
  };
});

const buildProof = async (
  holderDid,
  holderKeyPair,
  challenge = 'challenge',
) => {
  return jwtSign(
    {
      aud: 'https://localhost.test',
      iss: holderDid,
      nonce: challenge,
    },
    holderKeyPair.privateKey,
    {
      alg: 'ES256K',
      kid: `${holderDid}#0`,
      typ: 'openid4vci-proof+jwt',
    },
  );
};

const getCredentialInput = (badge) => {
  if (badge) {
    return {
      content: openBadgeCredentialContent,
      credentialType: 'OpenBadgeCredential',
      typeMetadata: {
        credentialType: 'OpenBadgeCredential',
        defaultSignatureAlgorithm: KeyAlgorithms.RS256,
        jsonldContext: ['https://www.openbadges.org/jsonld-context.json'],
        layer1: false,
        schemaUrl: 'https://example.com/OpenBadgeCredential.schema.json',
      },
    };
  }
  return {
    content: {
      credentialSubject: {
        legalEmployer: { name: 'Example Employer' },
        roleName: 'Engineer',
      },
      type: ['Employment'],
    },
    credentialType: 'Employment',
    typeMetadata: {
      credentialType: 'Employment',
      jsonldContext: [],
      layer1: true,
      schemaUrl: 'https://example.com/Employment.schema.json',
    },
  };
};

const clearCollections = async () =>
  Promise.all(
    [
      'allocations',
      'credentials',
      'depots',
      'exchanges',
      'issuerServices',
      'keys',
      'notification_events',
      'notifications',
      'tenants',
    ].map((collection) => mongoDb().collection(collection).deleteMany({})),
  );
