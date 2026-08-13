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
const { before, describe, it } = require('node:test');
const { expect } = require('expect');

const { set, flow } = require('lodash/fp');
const { credentialUnexpired } = require('@verii/sample-data');
const { CredentialDataModelVersions } = require('@verii/jwt');
const console = require('console');
const { VeriiProtocolVersions } = require('../src/verii-protocol-versions');
const { checkHolder } = require('../src/check-holder');
const { CheckResults } = require('../src/check-results');

const context = { log: { error: console.log.bind(console) } };

describe('holder checks', () => {
  before(async () => {});

  it('Should return FAIL when presentation issuer is not the credential subject id', async () => {
    const result = checkHolder(
      CredentialDataModelVersions.V1_1,
      flow(
        set('credentialSubject.id', 'not-match'),
        set('vnfProtocolVersion', VeriiProtocolVersions.PROTOCOL_VERSION_2),
      )(credentialUnexpired),
      'not-match-1',
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return NOT_APPLICABLE when vnf protocol version is less than 2', async () => {
    const result1 = checkHolder(
      CredentialDataModelVersions.V1_1,
      {},
      '',
      context,
    );
    const result2 = checkHolder(
      CredentialDataModelVersions.V1_1,
      { vnfProtocolVersion: 0 },
      '',
      context,
    );
    const result3 = checkHolder(
      CredentialDataModelVersions.V1_1,
      { vnfProtocolVersion: null },
      '',
      context,
    );
    const result4 = checkHolder(
      CredentialDataModelVersions.V1_1,
      { vnfProtocolVersion: 1.9 },
      '',
      context,
    );
    const result5 = checkHolder(
      CredentialDataModelVersions.V1_1,
      { vnfProtocolVersion: 2 },
      '',
      context,
    );
    expect(result1).toEqual(CheckResults.NOT_APPLICABLE);
    expect(result2).toEqual(CheckResults.NOT_APPLICABLE);
    expect(result3).toEqual(CheckResults.NOT_APPLICABLE);
    expect(result4).toEqual(CheckResults.NOT_APPLICABLE);
    expect(result5).toEqual(CheckResults.FAIL);
  });

  it('Should return PASS when presentation issuer is the credential subject id', async () => {
    const decodedCredential = flow(
      set('credentialSubject.id', 'match'),
      set('vnfProtocolVersion', VeriiProtocolVersions.PROTOCOL_VERSION_2),
    )(credentialUnexpired);
    expect(decodedCredential.credentialSubject.id).toEqual('match');
    const result = checkHolder(
      CredentialDataModelVersions.V1_1,
      decodedCredential,
      'match',
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  it('Should return PASS when the holder matches a credential subject array', () => {
    const result = checkHolder(
      CredentialDataModelVersions.V2_0,
      {
        credentialSubject: [{ id: 'holder-1' }, { id: 'holder-2' }],
      },
      'holder-2',
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  it('Should return FAIL for a wrong VC 2.0 holder without a protocol version', () => {
    const result = checkHolder(
      CredentialDataModelVersions.V2_0,
      { credentialSubject: { id: 'holder-1' } },
      'holder-2',
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return PASS for a matching VC 2.0 holder without a protocol version', () => {
    const result = checkHolder(
      CredentialDataModelVersions.V2_0,
      { credentialSubject: { id: 'holder-1' } },
      'holder-1',
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });
});
