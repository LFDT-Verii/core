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

const {
  compact,
  isNil,
  pick,
  omit,
  omitBy,
  first,
  uniq,
} = require('lodash/fp');
const {
  DID_FORMAT,
  BASE64_FORMAT,
} = require('@verii/test-regexes');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { castArray } = require('lodash');
const { credentialTypeMetadata } = require('./credential-type-metadata');

const jwtVcExpectation = ({
  tenant,
  offer,
  credentialId,
  credentialTypeContext = [
    'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
  ],
  issuer,
  payload = {},
}) => {
  const credentialContextExpectation = uniq(
    compact([
      'https://www.w3.org/2018/credentials/v1',
      ...credentialTypeContext,
      ...castArray(offer['@context']),
      'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
    ])
  );
  return {
    header: {
      alg: 'ES256K',
      kid: `${credentialId}#key-1`,
      typ: 'JWT',
    },
    payload: {
      iat: expect.any(Number),
      iss: tenant.did,
      nbf: expect.any(Number),
      jti: credentialId,
      ...payload,
      vc: omitBy(isNil, {
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
        '@context': credentialContextExpectation,
        vnfProtocolVersion: offer.vnfProtocolVersion ?? 1,
        type: [
          first(offer.type),
          'VelocityNetworkLayer1Credential',
          'VerifiableCredential',
        ],
        id: credentialId,
        issuer: issuer ?? {
          id: expect.stringMatching(DID_FORMAT),
        },
        credentialSubject: omit(['vendorUserId'], offer.credentialSubject),
        linkCodeCommitment:
          offer.linkCodeCommitment != null
            ? {
                type: 'VelocityCredentialLinkCodeCommitment2022',
                value: expect.stringMatching(BASE64_FORMAT),
              }
            : undefined,
        credentialSchema: {
          id: credentialTypeMetadata[first(offer.type)].schemaUrl,
          type: 'JsonSchemaValidator2018',
        },
        credentialStatus: {
          id: expect.stringMatching(
            '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-zA-F]+&listId=\\d+&index=\\d+$'
          ),
          type: VelocityRevocationListType,
        },
        refreshService: {
          type: 'VelocityNetworkRefreshService2024',
          id: `${tenant.did}#foo-service-id-1`,
        },
        issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
        validFrom: offer.validFrom,
        validUntil: offer.validUntil,
      }),
    },
  };
};

module.exports = { jwtVcExpectation };
