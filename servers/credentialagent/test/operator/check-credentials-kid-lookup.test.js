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

// Exercises check-credentials with the real verifier, MongoDB tenant keys and
// did:velocity contracts deployed to the local Besu node. Only the registrar
// HTTP API is mocked.
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { nanoid } = require('nanoid');
const {
  generateJWAKeyPair,
  generateKeyPair,
  hashAndEncodeHex,
  KeyAlgorithms,
  KeyPurposes,
} = require('@verii/crypto');
const { jwtSign } = require('@verii/jwt');
const { ALG_TYPE } = require('@verii/metadata-registration');
const { CheckResults } = require('@verii/vc-checks');
const {
  anchorCredentialMetadataList,
  deployDidVelocityLedger,
} = require('@verii/verii-verification/test/helpers/did-velocity-ledger');
const {
  signV1Credential,
  signV2Credential,
} = require('@verii/verii-verification/test/helpers/sign-credentials');
const nock = require('../helpers/nock');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initKeysFactory, initTenantFactory } = require('../../src/entities');

const credentialType = 'EmailV1.0';
const holderDid = 'did:example:holder';
const issuerDid = 'did:example:issuer';
const registrarUrl = 'http://oracle.localhost.test';
const noop = () => {};
const log = { debug: noop, error: noop, info: noop, warn: noop };

describe(
  'check-credentials did:velocity kid lookup',
  { timeout: 300000 },
  () => {
    const issuerKeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
    const v1KeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
    const v2KeyPair = generateJWAKeyPair(KeyAlgorithms.ES256);
    let fastify;
    let persistKey;
    let persistTenant;
    let tenant;
    let v1CredentialId;
    let v2CredentialId;

    before(async () => {
      const setupContext = { caoDid: 'did:ion:cao', log, traceId: nanoid() };
      const ledger = await deployDidVelocityLedger(
        [credentialType],
        setupContext,
      );
      const issuerVc = await jwtSign(
        { vc: { type: ['CredentialMetadataListHeader'] } },
        issuerKeyPair.privateKey,
        { issuer: issuerDid, kid: `${issuerDid}#key-1` },
      );
      [v1CredentialId] = await anchorCredentialMetadataList(
        ledger,
        {
          algType: ALG_TYPE.HEX_AES_256,
          entries: [anchoredEntry(1, v1KeyPair.publicKey)],
          issuerVc,
          listId: 1,
        },
        setupContext,
      );
      [v2CredentialId] = await anchorCredentialMetadataList(
        ledger,
        {
          algType: ALG_TYPE.COSEKEY_AES_256,
          entries: [anchoredEntry(1, v2KeyPair.publicKey)],
          issuerVc,
          listId: 2,
        },
        setupContext,
      );

      fastify = buildFastify(ledger.config);
      await fastify.ready();
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistKey } = initKeysFactory(fastify));
    });

    beforeEach(async () => {
      nock.cleanAll();
      mockRegistrar(issuerKeyPair.publicKey);
      tenant = await persistTenant();
      await persistKey({
        kidFragment: '#dlt-1',
        keyPair: generateKeyPair({ format: 'jwk' }),
        purposes: [KeyPurposes.DLT_TRANSACTIONS],
        tenant,
      });
    });

    after(async () => {
      await fastify.close();
      nock.cleanAll();
    });

    it('passes VC 1.1 and VC 2.0 credentials whose kid is the exact resolved DID URL', async () => {
      const response = await checkCredentials(fastify, tenant, [
        await signV1Credential(
          buildV1Credential(v1CredentialId),
          v1KeyPair.privateKey,
          `${v1CredentialId}#key-1`,
        ),
        signV2Credential(
          buildV2Credential(v2CredentialId),
          v2KeyPair.privateKey,
          `${v2CredentialId}#key-1`,
        ),
      ]);

      expect(response.statusCode).toEqual(200);
      expect(response.json.credentials).toEqual([
        expect.objectContaining({
          credentialChecks: {
            TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
            TRUSTED_ISSUER: CheckResults.PASS,
            UNEXPIRED: CheckResults.PASS,
            UNREVOKED: CheckResults.NOT_APPLICABLE,
            UNTAMPERED: CheckResults.PASS,
          },
          id: v1CredentialId,
        }),
        expect.objectContaining({
          credentialChecks: {
            // check-credentials has no expected holder, and VC 2.0 always
            // requires one.
            TRUSTED_HOLDER: CheckResults.FAIL,
            TRUSTED_ISSUER: CheckResults.PASS,
            UNEXPIRED: CheckResults.PASS,
            UNREVOKED: CheckResults.NOT_APPLICABLE,
            UNTAMPERED: CheckResults.PASS,
          },
          id: v2CredentialId,
        }),
      ]);
    });

    it('reports DATA_INTEGRITY_ERROR for a kid that matches the resolved DID URL only case-insensitively', async () => {
      const response = await checkCredentials(fastify, tenant, [
        await signV1Credential(
          buildV1Credential(v1CredentialId),
          v1KeyPair.privateKey,
          `${v1CredentialId}#KEY-1`,
        ),
      ]);

      expect(response.statusCode).toEqual(200);
      expect(response.json.credentials).toEqual([
        expect.objectContaining({
          credentialChecks: {
            TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
            TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
            UNEXPIRED: CheckResults.NOT_CHECKED,
            UNREVOKED: CheckResults.NOT_CHECKED,
            UNTAMPERED: CheckResults.DATA_INTEGRITY_ERROR,
          },
          id: v1CredentialId,
        }),
      ]);
    });
  },
);

const checkCredentials = (fastify, { _id }, rawCredentials) =>
  fastify.injectJson({
    method: 'POST',
    payload: {
      rawCredentials: rawCredentials.map((rawCredential, i) => ({
        id: `${i}`,
        rawCredential,
      })),
    },
    url: `/operator-api/v0.8/tenants/${_id}/check-credentials`,
  });

const mockRegistrar = (issuerPublicKey) => {
  nock(registrarUrl)
    .persist()
    .get(`/api/v0.6/resolve-did/${encodeURIComponent(issuerDid)}`)
    .reply(200, {
      id: issuerDid,
      publicKey: [{ id: '#key-1', publicKeyJwk: issuerPublicKey }],
    });
  nock(registrarUrl)
    .persist()
    .get(
      `/api/v0.6/organizations/${encodeURIComponent(issuerDid)}/verified-profile`,
    )
    .reply(200, {
      credentialSubject: {
        id: issuerDid,
        permittedVelocityServiceCategory: ['ContactIssuer'],
      },
    });
  nock(registrarUrl)
    .persist()
    .get('/api/v0.6/credential-types')
    .query(true)
    .reply(200, [{ credentialType, issuerCategory: 'ContactIssuer' }]);
};

const anchoredEntry = (index, publicKey) => ({
  contentHash: hashAndEncodeHex(nanoid()),
  credentialType,
  index,
  publicKey,
});

const buildV1Credential = (id) => ({
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  credentialSubject: { email: 'holder@example.com', id: holderDid },
  expirationDate: '2099-01-01T00:00:00.000Z',
  id,
  issuanceDate: '2026-01-01T00:00:00.000Z',
  issuer: { id: issuerDid },
  type: [credentialType, 'VerifiableCredential'],
});

const buildV2Credential = (id) => ({
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  credentialSubject: { email: 'holder@example.com', id: holderDid },
  id,
  issuer: issuerDid,
  type: ['VerifiableCredential', credentialType],
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2099-01-01T00:00:00.000Z',
});
