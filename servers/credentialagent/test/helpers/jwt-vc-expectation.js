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
const {
  castArray,
  compact,
  first,
  isNil,
  omitBy,
  pick,
  uniq,
} = require('lodash/fp');
const { ISO_DATETIME_FORMAT, DID_FORMAT } = require('@verii/test-regexes');
const { VelocityRevocationListType } = require('@verii/vc-checks');

const jwtVcExpectation = ({
  tenant,
  issuerService,
  credential,
  credentialId,
  subjectId,
  credentialSubjectContext = [],
  credentialTypeMetadata,
  issuer,
  payload = {},
}) => ({
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
    sub: subjectId,
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
        credential.content
      ),
      '@context': uniq(
        compact([
          'https://www.w3.org/2018/credentials/v1',
          ...credentialSubjectContext,
          ...castArray(credential.content['@context']),
          'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
        ])
      ),
      id: credentialId,
      type: [
        first(credential.content.type),
        'VelocityNetworkLayer1Credential',
        'VerifiableCredential',
      ],
      credentialSubject: {
        ...credential.content.credentialSubject,
        id: subjectId,
      },
      vnfProtocolVersion: 2,
      issuer: issuer ?? {
        id: expect.stringMatching(DID_FORMAT),
      },
      credentialSchema: {
        id: credentialTypeMetadata[first(credential.content.type)].schemaUrl,
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
        id: `${tenant.did}${issuerService.velocityNetworkServiceId}`,
      },
      contentHash: {
        type: 'VelocityContentHash2020',
        value: credential.contentHash,
      },
      issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
    }),
  },
});

module.exports = { jwtVcExpectation };
