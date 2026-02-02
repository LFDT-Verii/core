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

const { generateCredentialJwt } = require('@verii/jwt');
const { credentialUnexpired } = require('@verii/sample-data');
const { generateKeyPairInHexAndJwk } = require('@verii/tests-helpers');
const console = require('console');
const { checkJwsVcTampering } = require('../src/check-jws-vc-tampering');
const { CheckResults } = require('../src/check-results');

describe('tampering checks', () => {
  const keyPair = generateKeyPairInHexAndJwk();
  const context = { log: console };

  let signedCredential;

  before(async () => {
    signedCredential = await generateCredentialJwt(
      credentialUnexpired,
      keyPair.privateJwk,
      'KID',
    );
  });

  it('Should return FAIL when tampered', async () => {
    const otherCredential = await generateCredentialJwt(
      { ...credentialUnexpired, issuer: 'TAMPERED' },
      keyPair.privateJwk,
      'KID',
    );

    const tamperedCredential = signedCredential
      .split('.')
      .slice(0, 2)
      .concat(otherCredential.split('.').slice(-1))
      .join('.');

    const result = await checkJwsVcTampering(
      tamperedCredential,
      keyPair.publicJwk,
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return PASS when untampered', async () => {
    const result = await checkJwsVcTampering(
      signedCredential,
      keyPair.publicJwk,
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });
});
