/*
 * Copyright 2025 Velocity Team
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

/* eslint-disable complexity */
const { compact, filter, flow, map } = require('lodash/fp');
const { register } = require('@spencejs/spence-factories');
const {
  createDidDoc,
  toRelativeServiceId,
} = require('@verii/did-doc');
const {
  categorizeServices,
} = require('@verii/organizations-registry');
const { hexFromJwk } = require('@verii/jwt');
const {
  KeyPurposes,
  generateKeyPair,
  KeyAlgorithms,
} = require('@verii/crypto');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');

const { ObjectId } = require('mongodb');
const {
  initBuildProfileVerifiableCredential,
  initBuildProfileVcUrl,
  normalizeProfileName,
  Authorities,
} = require('../domains');

const organizationsRepoPlugin = require('../repos/repo');

module.exports = (app) => {
  const buildProfileVerifiableCredential =
    initBuildProfileVerifiableCredential(app);

  const buildProfileVcUrl = initBuildProfileVcUrl({
    registrarUrl: app.config.hostUrl,
  });

  return register(
    'organization',
    organizationsRepoPlugin(app)(app),
    async (overrides, { getOrBuild }) => {
      const nonce = generateKeyPair().privateKey;
      const website = await getOrBuild(
        'website',
        () => `https://www.${nonce}.organization.com`
      );
      const did = await getOrBuild('did', () => `did:test:${nonce}`);
      const alsoKnownAs = await getOrBuild('alsoKnownAs', () => undefined);
      const didNotCustodied = await getOrBuild('didNotCustodied', () => false);
      const services = await getOrBuild('service', () => []);
      const activatedServiceIds = await getOrBuild('activatedServiceIds', () =>
        flow(map('id'), compact, map(toRelativeServiceId))(services)
      );
      const activatedServices = filter(
        (s) => activatedServiceIds.includes(s.id),
        services
      );
      const { publicKey: ethereumKey } = generateKeyPair({ format: 'jwk' });
      const { publicKey: dltTransactionsPublicKey } = generateKeyPair({
        format: 'jwk',
      });

      const keys = await getOrBuild('keys', () => [
        {
          id: '#eth-account-key-1',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          type: 'EcdsaSecp256k1VerificationKey2019',
          publicKey: dltTransactionsPublicKey,
          algorithm: KeyAlgorithms.SECP256K1,
        },
      ]);
      const { didDoc } = createDidDoc({
        did,
        services,
        keys,
        alsoKnownAs,
      });

      // eslint-disable-next-line better-mutation/no-mutation
      didDoc.id = await getOrBuild('didDocId', () => didDoc.id);

      const mergeIds = await getOrBuild('_mergeIds', () => {});

      const ids = {
        did: didDoc.id,
        ethereumAccount: toEthereumAddress(hexFromJwk(ethereumKey, false)),
        fineractClientId: '1',
        tokenAccountId: '9',
        escrowAccountId: '5',
        brokerClientId: new ObjectId(),
        ...mergeIds,
      };
      const commercialEntities = await getOrBuild(
        'commercialEntities',
        () => undefined
      );
      const skipTechnicalEmail = await getOrBuild(
        'skipTechnicalEmail',
        () => false
      );
      const skipContactEmail = await getOrBuild(
        'skipContactEmail',
        () => false
      );
      const ovverideObj = overrides();
      const profile = ovverideObj.profile || {
        name: await getOrBuild('name', () => 'Test Organization'),
        ...(commercialEntities && { commercialEntities }),
        logo: 'http://www.organization.com/logo.png',
        website,
        registrationNumbers: [
          {
            authority: Authorities.DunnAndBradstreet,
            number: '1',
            uri: 'uri://uri',
          },
        ],
        location: {
          countryCode: 'US',
          regionCode: 'NY',
        },
        type: 'company',
        founded: '2020-01-01',
        closed: '2020-01-01',
        description: 'Short description',
        permittedVelocityServiceCategory: categorizeServices(activatedServices),
        linkedInProfile: 'https://www.linkedin.com/in/test-profile',
        physicalAddress: {
          line1: '123 Main St',
          line2: 'Suite 123',
          line3: 'New York',
        },
        adminGivenName: 'Admin Given Name',
        adminFamilyName: 'Admin Family Name',
        adminTitle: 'Admin Title',
        adminEmail: 'admin@email.com',
        signatoryGivenName: 'Signatory Given Name',
        signatoryFamilyName: 'Signatory Family Name',
        signatoryTitle: 'Signatory Title',
        signatoryEmail: 'signatory@email.com',
        ...(!skipTechnicalEmail && { technicalEmail: 'technical@email.com' }),
        ...(!skipContactEmail && { contactEmail: 'contact@example.com' }),
      };

      const { jwtVc, credentialId } = await buildProfileVerifiableCredential(
        profile,
        didDoc
      );
      const verifiableCredentialJwt = buildProfileVcUrl(didDoc, credentialId);
      return {
        didDoc: didNotCustodied
          ? { id: didDoc.id }
          : { ...didDoc, service: services },
        profile,
        signedProfileVcJwt: { signedCredential: jwtVc, credentialId },
        verifiableCredentialJwt,
        authClients: [],
        services,
        activatedServiceIds,
        didNotCustodied,
        normalizedProfileName: await getOrBuild('normalizedProfileName', () =>
          normalizeProfileName(profile.name)
        ),
        ids,
        ...ovverideObj,
      };
    }
  );
};
