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

const { expect } = require('expect');

const { compact, first, last, omit, pick, uniq } = require('lodash/fp');
const { castArray } = require('lodash');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { KeyAlgorithms } = require('@verii/crypto');
const { keyAlgorithmToJoseAlg } = require('@verii/jwt');
const { credentialTypeMetadata } = require('./credential-types-map');
const { hashOffer } = require('../../src/domain/hash-offer');

// eslint-disable-next-line complexity
const jwtVcExpectation = (
  { issuerEntity, offer, credentialId, userId, issuer, payload = {} },
  context
) => {
  const typeMetadata = credentialTypeMetadata[extractOfferType(offer)];
  const contextExpectation = uniq(
    compact([
      'https://www.w3.org/2018/credentials/v1',
      ...castArray(typeMetadata.jsonldContext),
      ...castArray(offer['@context']),
      'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
    ])
  );
  return {
    header: {
      alg: keyAlgorithmToJoseAlg(
        typeMetadata.defaultSignatureAlgorithm ?? KeyAlgorithms.SECP256K1
      ),
      kid: `${credentialId}#key-1`,
      typ: 'JWT',
    },
    payload: {
      iat: expect.any(Number),
      iss: issuerEntity.did,
      nbf: expect.any(Number),
      jti: credentialId,
      sub: userId,
      ...payload,
      vc: {
        ...pick(
          [
            'credentialSchema',
            'contentHash',
            'vnfProtocolVersion',
            'replaces',
            'relatedResource',
          ],
          offer
        ),
        credentialSubject: {
          id: userId,
          ...omit(['vendorUserId'], offer.credentialSubject),
          '@context':
            context?.config?.credentialSubjectContext === true
              ? contextExpectation
              : undefined,
        },
        '@context': contextExpectation,
        vnfProtocolVersion: offer.vnfProtocolVersion ?? 2,
        type: expect.arrayContaining([
          extractOfferType(offer),
          typeMetadata.layer1
            ? 'VelocityNetworkLayer1Credential'
            : 'VelocityNetworkLayer2Credential',
          'VerifiableCredential',
        ]),
        id: credentialId,
        issuer: issuer ?? {
          id: issuerEntity.did,
        },
        credentialStatus:
          offer.credentialStatus != null
            ? [
                ...castArray(offer.credentialStatus),
                velocityCredentialStatus(issuerEntity),
              ]
            : velocityCredentialStatus(issuerEntity),
        refreshService:
          offer.refreshService != null
            ? [
                ...castArray(offer.refreshService),
                velocityRefreshService(issuerEntity),
              ]
            : velocityRefreshService(issuerEntity),
        credentialSchema: offer.credentialSchema ?? {
          type: 'JsonSchemaValidator2018',
          id: typeMetadata.schemaUrl,
        },
        contentHash: {
          type: 'VelocityContentHash2020',
          value: hashOffer(offer),
        },
        issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
      },
    },
  };
};

const velocityCredentialStatus = ({ primaryAddress }) => ({
  id: expect.stringMatching(
    `^ethereum:0x1234/getRevokedStatus\\?address=${primaryAddress}&listId=\\d+&index=\\d+$`
  ),
  type: VelocityRevocationListType,
});

const velocityRefreshService = ({ did, service }) => ({
  type: 'VelocityNetworkRefreshService2024',
  id: `${did}${last(service).id}`,
});

const extractOfferType = (offer) => first(castArray(offer.type));

module.exports = { jwtVcExpectation, extractOfferType };
