/*
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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  assertOpenid4vciCredentialResult,
  isOpenid4vciCredentialFormat,
  Openid4vciCredentialProfile,
} = require('../../src/entities/openid4vci/domain');

describe('OpenID4VCI credential profile', () => {
  it('defines the one deployment credential profile', () => {
    expect(Openid4vciCredentialProfile).toEqual({
      context: 'https://www.w3.org/ns/credentials/v2',
      dataModelVersion: '2.0',
      envelopeFormat: 'vc+jwt',
      format: 'application/vc+jwt',
    });
    expect(Object.isFrozen(Openid4vciCredentialProfile)).toEqual(true);
  });

  it('accepts the explicit profile or an identifier-based request without a format', () => {
    expect(isOpenid4vciCredentialFormat()).toEqual(true);
    expect(isOpenid4vciCredentialFormat('application/vc+jwt')).toEqual(true);
  });

  it('rejects explicit values outside the profile', () => {
    expect(isOpenid4vciCredentialFormat(null)).toEqual(false);
    expect(isOpenid4vciCredentialFormat('jwt_vc_json-ld')).toEqual(false);
    expect(isOpenid4vciCredentialFormat('vc+jwt')).toEqual(false);
  });

  it('accepts only a neutral result matching the profile', () => {
    expect(() =>
      assertOpenid4vciCredentialResult({
        dataModelVersion: '2.0',
        envelopeFormat: 'vc+jwt',
      }),
    ).not.toThrow();
    expect(() =>
      assertOpenid4vciCredentialResult({
        dataModelVersion: '1.1',
        envelopeFormat: 'jwt_vc_json-ld',
      }),
    ).toThrow('OpenID4VCI issuer returned an unsupported credential');
    expect(() => assertOpenid4vciCredentialResult()).toThrow(
      'OpenID4VCI issuer returned an unsupported credential',
    );
  });
});
