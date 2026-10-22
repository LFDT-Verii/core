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

// Runs the public verifier without module mocks: did:jwk keys resolve
// in-process and the revocation registry client targets a contract deployed to
// the local Besu node. Only the registrar HTTP fetchers are stubbed, and they
// vouch for the impersonated organization to show that registrar trust cannot
// stand in for issuer/key binding.
const { randomUUID } = require('node:crypto');
const { before, describe, it } = require('node:test');
const { expect } = require('expect');
const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { CredentialVerificationErrorCodes } = require('@verii/jwt');
const { CheckResults } = require('@verii/vc-checks');
const {
  deployPermissionContract,
  deployRevocationContract,
  rpcProvider,
} = require('@verii/metadata-registration/test/helpers/deploy-contracts');
const { verifyCredentials } = require('../index');
const {
  Envelopes,
  buildCareerWalletSelfReportedCredential,
  signCredential,
} = require('./helpers/self-signed-credentials');

const credentialType = 'EmploymentPastV1.1';
const holderDid = 'did:example:holder';
const victimOrgDid = 'did:web:victim-org.example.com';
const noop = () => {};
const log = { debug: noop, error: noop, info: noop, warn: noop };

const envelopes = [
  {
    buildCredential: (issuer) => ({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      credentialSubject: { employer: 'Example Corp', id: holderDid },
      expirationDate: '2099-01-01T00:00:00.000Z',
      id: `urn:uuid:${randomUUID()}`,
      issuanceDate: '2026-01-01T00:00:00.000Z',
      issuer: { id: issuer },
      type: [credentialType, 'VerifiableCredential'],
    }),
    envelope: Envelopes.V1_1,
    trustedHolder: CheckResults.NOT_APPLICABLE,
  },
  {
    buildCredential: (issuer) => ({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      credentialSubject: { employer: 'Example Corp', id: holderDid },
      id: `urn:uuid:${randomUUID()}`,
      issuer,
      type: ['VerifiableCredential', credentialType],
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2099-01-01T00:00:00.000Z',
    }),
    envelope: Envelopes.V2_0,
    trustedHolder: CheckResults.PASS,
  },
];

describe('issuer/key binding', { timeout: 120000 }, () => {
  let context;

  before(async () => {
    const setupContext = { log };
    const permissionsAddress = await deployPermissionContract();
    const revocationContractAddress = await deployRevocationContract(
      permissionsAddress,
      setupContext,
    );
    context = {
      config: { revocationContractAddress },
      log,
      rpcProvider,
      tenant: { did: 'did:example:relying-party' },
    };
  });

  envelopes.forEach(({ buildCredential, envelope, trustedHolder }) => {
    describe(envelope, () => {
      const attacker = generateJWAKeyPair(KeyAlgorithms.ES256);
      const attackerDid = getDidUriFromJwk(attacker.publicKey);
      const victim = generateJWAKeyPair(KeyAlgorithms.ES256);
      const victimDid = getDidUriFromJwk(victim.publicKey);
      const signedChecks = (trustedIssuer) => ({
        TRUSTED_HOLDER: trustedHolder,
        TRUSTED_ISSUER: trustedIssuer,
        UNEXPIRED: CheckResults.PASS,
        UNREVOKED: CheckResults.NOT_APPLICABLE,
        UNTAMPERED: CheckResults.PASS,
      });

      it('does not authenticate an unrelated issuer with an attacker-generated embedded jwk', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimOrgDid),
            attacker.privateKey,
            { jwk: attacker.publicKey },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          signedChecks(CheckResults.FAIL),
        );
      });

      it('reports SELF_SIGNED when the issuer is the did:jwk derived from the embedded jwk', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(attackerDid),
            attacker.privateKey,
            { jwk: attacker.publicKey },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          signedChecks(CheckResults.SELF_SIGNED),
        );
      });

      it('reports a key/issuer mismatch when a did:jwk issuer is not derived from the embedded jwk', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimDid),
            attacker.privateKey,
            { jwk: attacker.publicKey },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          signedChecks(CheckResults.DATA_INTEGRITY_ERROR),
        );
      });

      it('reports SELF_SIGNED only when the did:jwk kid is the issuer and verifies the signature', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimDid),
            victim.privateKey,
            { kid: `${victimDid}#0` },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          signedChecks(CheckResults.SELF_SIGNED),
        );
      });

      [
        ['an unrelated issuer', victimOrgDid],
        ['another did:jwk issuer', victimDid],
      ].forEach(([issuerDescription, issuer]) => {
        it(`reports a key/issuer mismatch when a did:jwk kid claims ${issuerDescription}`, async () => {
          const [result] = await verify(
            signCredential(
              envelope,
              buildCredential(issuer),
              attacker.privateKey,
              { kid: `${attackerDid}#0` },
            ),
            context,
          );

          expectDidJwkMismatch(envelope, result, signedChecks);
        });
      });

      it('does not fall back to the embedded jwk when the kid does not resolve', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimDid),
            attacker.privateKey,
            { jwk: attacker.publicKey, kid: `${victimDid}#attacker` },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          unverifiedChecks(CheckResults.DATA_INTEGRITY_ERROR),
        );
      });

      it('does not fall back to the embedded jwk when the kid resolves to a different key', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimDid),
            attacker.privateKey,
            { jwk: attacker.publicKey, kid: `${victimDid}#0` },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          unverifiedChecks(CheckResults.FAIL),
        );
      });

      it('does not fall back to the embedded jwk when the kid uses an unsupported DID method', async () => {
        const [result] = await verify(
          signCredential(
            envelope,
            buildCredential(victimOrgDid),
            attacker.privateKey,
            { jwk: attacker.publicKey, kid: `${victimOrgDid}#key-1` },
          ),
          context,
        );

        expect(result.credentialChecks).toEqual(
          unverifiedChecks(CheckResults.DEPENDENCY_RESOLUTION_ERROR),
        );
      });
    });
  });

  describe('VC 1.1 compatibility', () => {
    it('does not authenticate the issuer of a Career Wallet self-reported credential', async () => {
      const keyPair = generateJWAKeyPair(KeyAlgorithms.ES256);
      const [result] = await verify(
        buildCareerWalletSelfReportedCredential(keyPair),
        context,
      );

      expect(result).toEqual(
        expect.objectContaining({
          credentialChecks: {
            TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
            TRUSTED_ISSUER: CheckResults.FAIL,
            UNEXPIRED: CheckResults.NOT_APPLICABLE,
            UNREVOKED: CheckResults.NOT_APPLICABLE,
            UNTAMPERED: CheckResults.PASS,
          },
          dataModelVersion: '1.1',
          signingAlgorithm: 'ES256',
        }),
      );
    });
  });
});

const verify = (credential, context) =>
  verifyCredentials(
    {
      credentials: [credential],
      expectedHolderDid: holderDid,
      relyingParty: {},
    },
    buildRegistrarFetchers(),
    context,
  );

const expectDidJwkMismatch = (envelope, result, signedChecks) => {
  if (envelope === Envelopes.V1_1) {
    expect(result.credentialChecks).toEqual(
      signedChecks(CheckResults.DATA_INTEGRITY_ERROR),
    );
    return;
  }
  // VC 2.0 enforces the did:jwk binding in @verii/jwt conformance.
  expect(result.credentialChecks).toEqual(unverifiedChecks(CheckResults.FAIL));
  expect(result.conformance.errors).toEqual([
    {
      code: CredentialVerificationErrorCodes.SELF_SIGNED_ISSUER_INVALID,
      property: 'kid',
    },
  ]);
};

const unverifiedChecks = (untampered) => ({
  TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
  TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
  UNEXPIRED: CheckResults.NOT_CHECKED,
  UNREVOKED: CheckResults.NOT_CHECKED,
  UNTAMPERED: untampered,
});

// The registrar vouches for the impersonated organization.
const buildRegistrarFetchers = () => ({
  getCredentialTypeMetadata: async () => [
    { credentialType, issuerCategory: 'RegularIssuer' },
  ],
  getOrganizationVerifiedProfile: async (did) => ({
    credentialSubject: {
      id: did,
      permittedVelocityServiceCategory: ['Issuer', 'NotaryIssuer'],
    },
  }),
  resolveDid: async (did) => ({ id: did, publicKey: [] }),
});
