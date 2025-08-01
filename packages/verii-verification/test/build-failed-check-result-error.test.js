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
const { nanoid } = require('nanoid');
const {
  buildFailedCheckResultError,
} = require('../src/build-failed-check-result-error');
const { CredentialCheckResultValue } = require('../src/constants');

const didVelocity = `did:velocity:${nanoid()}`;
describe('throw error on failed check result', () => {
  it('should throw if tampered', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.FAIL,
            TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
            TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
            UNREVOKED: CredentialCheckResultValue.FAIL,
            UNEXPIRED: CredentialCheckResultValue.FAIL,
          },
        },
        { log: console }
      )
    ).toEqual(new Error('presentation_credential_tampered'));
  });
  it('should throw if bad issuer', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.PASS,
            TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
            TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
            UNREVOKED: CredentialCheckResultValue.FAIL,
            UNEXPIRED: CredentialCheckResultValue.FAIL,
          },
        },
        { log: console }
      )
    ).toEqual(new Error('presentation_credential_bad_issuer'));
  });
  it('should throw if credential revoked', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.PASS,
            TRUSTED_ISSUER: CredentialCheckResultValue.PASS,
            TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
            UNREVOKED: CredentialCheckResultValue.FAIL,
            UNEXPIRED: CredentialCheckResultValue.FAIL,
          },
        },
        { log: console }
      )
    ).toEqual(new Error('presentation_credential_revoked'));
  });
  it('should throw if credential expired', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.PASS,
            TRUSTED_ISSUER: CredentialCheckResultValue.PASS,
            TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
            UNREVOKED: CredentialCheckResultValue.PASS,
            UNEXPIRED: CredentialCheckResultValue.FAIL,
          },
        },
        { log: console }
      )
    ).toEqual(new Error('presentation_credential_expired'));
  });
  it('should throw if bad holder', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.PASS,
            TRUSTED_ISSUER: CredentialCheckResultValue.PASS,
            TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
            UNREVOKED: CredentialCheckResultValue.PASS,
            UNEXPIRED: CredentialCheckResultValue.PASS,
          },
        },
        { log: console }
      )
    ).toEqual(new Error('presentation_credential_bad_holder'));
  });
  it('should not throw if check results pass', () => {
    expect(
      buildFailedCheckResultError(
        {
          credential: { id: didVelocity },
          credentialChecks: {
            UNTAMPERED: CredentialCheckResultValue.PASS,
            TRUSTED_ISSUER: CredentialCheckResultValue.PASS,
            TRUSTED_HOLDER: CredentialCheckResultValue.PASS,
            UNREVOKED: CredentialCheckResultValue.PASS,
            UNEXPIRED: CredentialCheckResultValue.PASS,
          },
        },
        { log: console }
      )
    ).toBeUndefined();
  });
});
