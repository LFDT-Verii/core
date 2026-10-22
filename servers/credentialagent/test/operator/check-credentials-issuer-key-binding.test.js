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

// Exercises check-credentials with the real verifier and MongoDB tenant keys.
// Only the registrar HTTP API is mocked, and it vouches for the impersonated
// organization.
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const {
  generateJWAKeyPair,
  generateKeyPair,
  KeyAlgorithms,
  KeyPurposes,
} = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { CheckResults } = require('@verii/vc-checks');
const {
  Envelopes,
  buildCareerWalletSelfReportedCredential,
  signCredential,
} = require('@verii/verii-verification/test/helpers/self-signed-credentials');
const nock = require('../helpers/nock');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initKeysFactory, initTenantFactory } = require('../../src/entities');

const credentialType = 'EmploymentPastV1.1';
const holderDid = 'did:example:holder';
const victimOrgDid = 'did:web:victim-org.example.com';
const registrarUrl = 'http://oracle.localhost.test';

const signedChecks = (trustedIssuer, trustedHolder) => ({
  TRUSTED_HOLDER: trustedHolder,
  TRUSTED_ISSUER: trustedIssuer,
  UNEXPIRED: CheckResults.PASS,
  UNREVOKED: CheckResults.NOT_APPLICABLE,
  UNTAMPERED: CheckResults.PASS,
});

describe('check-credentials issuer/key binding', () => {
  const attacker = generateJWAKeyPair(KeyAlgorithms.ES256);
  const attackerDid = getDidUriFromJwk(attacker.publicKey);
  let fastify;
  let persistKey;
  let persistTenant;
  let tenant;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
  });

  beforeEach(async () => {
    nock.cleanAll();
    mockRegistrar();
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

  it('reports FAIL, not SELF_SIGNED, for a Career Wallet self-reported credential', async () => {
    const response = await checkCredentials(fastify, tenant, [
      buildCareerWalletSelfReportedCredential(
        generateJWAKeyPair(KeyAlgorithms.ES256),
      ),
    ]);

    expect(response.statusCode).toEqual(200);
    expect(checksOf(response)).toEqual([
      {
        TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
        TRUSTED_ISSUER: CheckResults.FAIL,
        UNEXPIRED: CheckResults.NOT_APPLICABLE,
        UNREVOKED: CheckResults.NOT_APPLICABLE,
        UNTAMPERED: CheckResults.PASS,
      },
    ]);
  });

  it('reports FAIL for VC 1.1 and VC 2.0 credentials whose embedded jwk is not bound to the issuer', async () => {
    const response = await checkCredentials(fastify, tenant, [
      signCredential(
        Envelopes.V1_1,
        buildV1Credential(victimOrgDid),
        attacker.privateKey,
        { jwk: attacker.publicKey },
      ),
      signCredential(
        Envelopes.V2_0,
        buildV2Credential(victimOrgDid),
        attacker.privateKey,
        { jwk: attacker.publicKey },
      ),
    ]);

    expect(response.statusCode).toEqual(200);
    expect(checksOf(response)).toEqual([
      signedChecks(CheckResults.FAIL, CheckResults.NOT_APPLICABLE),
      // check-credentials has no expected holder, and VC 2.0 always requires
      // one.
      signedChecks(CheckResults.FAIL, CheckResults.FAIL),
    ]);
  });

  it('reports SELF_SIGNED for VC 1.1 and VC 2.0 credentials whose did:jwk kid is the issuer', async () => {
    const response = await checkCredentials(fastify, tenant, [
      signCredential(
        Envelopes.V1_1,
        buildV1Credential(attackerDid),
        attacker.privateKey,
        { kid: `${attackerDid}#0` },
      ),
      signCredential(
        Envelopes.V2_0,
        buildV2Credential(attackerDid),
        attacker.privateKey,
        { kid: `${attackerDid}#0` },
      ),
    ]);

    expect(response.statusCode).toEqual(200);
    expect(checksOf(response)).toEqual([
      signedChecks(CheckResults.SELF_SIGNED, CheckResults.NOT_APPLICABLE),
      signedChecks(CheckResults.SELF_SIGNED, CheckResults.FAIL),
    ]);
  });

  it('reports DATA_INTEGRITY_ERROR for a VC 1.1 did:jwk kid that does not control the issuer', async () => {
    const response = await checkCredentials(fastify, tenant, [
      signCredential(
        Envelopes.V1_1,
        buildV1Credential(victimOrgDid),
        attacker.privateKey,
        { kid: `${attackerDid}#0` },
      ),
    ]);

    expect(response.statusCode).toEqual(200);
    expect(checksOf(response)).toEqual([
      signedChecks(
        CheckResults.DATA_INTEGRITY_ERROR,
        CheckResults.NOT_APPLICABLE,
      ),
    ]);
  });

  it('does not fall back to the embedded jwk when a VC 1.1 kid does not resolve', async () => {
    const victimDid = getDidUriFromJwk(
      generateJWAKeyPair(KeyAlgorithms.ES256).publicKey,
    );
    const response = await checkCredentials(fastify, tenant, [
      signCredential(
        Envelopes.V1_1,
        buildV1Credential(victimDid),
        attacker.privateKey,
        { jwk: attacker.publicKey, kid: `${victimDid}#attacker` },
      ),
    ]);

    expect(response.statusCode).toEqual(200);
    expect(checksOf(response)).toEqual([
      {
        TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
        TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
        UNEXPIRED: CheckResults.NOT_CHECKED,
        UNREVOKED: CheckResults.NOT_CHECKED,
        UNTAMPERED: CheckResults.DATA_INTEGRITY_ERROR,
      },
    ]);
  });
});

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

const checksOf = (response) =>
  response.json.credentials.map(({ credentialChecks }) => credentialChecks);

const mockRegistrar = () => {
  nock(registrarUrl)
    .persist()
    .get(/\/api\/v0\.6\/resolve-did\/.*/)
    .reply(200, (uri) => ({
      id: decodeURIComponent(uri.split('/').pop()),
      publicKey: [],
    }));
  nock(registrarUrl)
    .persist()
    .get(/\/api\/v0\.6\/organizations\/.*\/verified-profile/)
    .reply(200, (uri) => ({
      credentialSubject: {
        id: decodeURIComponent(uri.split('/').at(-2)),
        permittedVelocityServiceCategory: ['Issuer', 'NotaryIssuer'],
      },
    }));
  nock(registrarUrl)
    .persist()
    .get('/api/v0.6/credential-types')
    .query(true)
    .reply(200, [{ credentialType, issuerCategory: 'RegularIssuer' }]);
};

const buildV1Credential = (issuer) => ({
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  credentialSubject: { employer: 'Example Corp', id: holderDid },
  expirationDate: '2099-01-01T00:00:00.000Z',
  id: `urn:uuid:${randomUUID()}`,
  issuanceDate: '2026-01-01T00:00:00.000Z',
  issuer: { id: issuer },
  type: [credentialType, 'VerifiableCredential'],
});

const buildV2Credential = (issuer) => ({
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  credentialSubject: { employer: 'Example Corp', id: holderDid },
  id: `urn:uuid:${randomUUID()}`,
  issuer,
  type: ['VerifiableCredential', credentialType],
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2099-01-01T00:00:00.000Z',
});
