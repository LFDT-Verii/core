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
  assertOpenid4vciIssuedCredential,
  getOpenid4vciCredentialProfileByConfigurationId,
  getOpenid4vciCredentialProfileByFormat,
  isOpenid4vciCredentialFormat,
  Openid4vciCredentialProfiles,
} = require('../../src/entities/openid4vci/domain');

describe('OpenID4VCI credential profile', () => {
  const legacyProfile = Openid4vciCredentialProfiles['jwt_vc_json-ld'];
  const v2Profile = Openid4vciCredentialProfiles['vc+jwt'];

  it('defines frozen legacy and VCDM 2.0 deployment profiles', () => {
    expect(Openid4vciCredentialProfiles).toEqual({
      'jwt_vc_json-ld': {
        context: 'https://www.w3.org/2018/credentials/v1',
        credentialFormat: 'jwt_vc_json-ld',
        dataModelVersion: '1.1',
        format: 'jwt_vc_json-ld',
        selectionPriority: 0,
      },
      'vc+jwt': {
        context: 'https://www.w3.org/ns/credentials/v2',
        credentialFormat: 'vc+jwt',
        dataModelVersion: '2.0',
        format: 'application/vc+jwt',
        selectionPriority: 1,
      },
    });
    expect(Object.isFrozen(Openid4vciCredentialProfiles)).toEqual(true);
    expect(
      Object.values(Openid4vciCredentialProfiles).every(Object.isFrozen),
    ).toEqual(true);
  });

  it('accepts either explicit profile or an identifier-based request without a format', () => {
    expect(isOpenid4vciCredentialFormat()).toEqual(true);
    expect(isOpenid4vciCredentialFormat('jwt_vc_json-ld')).toEqual(true);
    expect(isOpenid4vciCredentialFormat('application/vc+jwt')).toEqual(true);
  });

  it('rejects explicit values outside the profile', () => {
    expect(isOpenid4vciCredentialFormat(null)).toEqual(false);
    expect(isOpenid4vciCredentialFormat('vc+jwt')).toEqual(false);
    expect(isOpenid4vciCredentialFormat('unknown')).toEqual(false);
  });

  it('resolves profiles by public format and credential configuration id', () => {
    expect(getOpenid4vciCredentialProfileByFormat('jwt_vc_json-ld')).toBe(
      legacyProfile,
    );
    expect(getOpenid4vciCredentialProfileByFormat('application/vc+jwt')).toBe(
      v2Profile,
    );
    expect(
      getOpenid4vciCredentialProfileByConfigurationId(
        'foundation.velocitynetwork.Employment',
        'Employment',
      ),
    ).toBe(legacyProfile);
    expect(
      getOpenid4vciCredentialProfileByConfigurationId(
        'foundation.velocitynetwork.Employment.vc+jwt',
        'Employment',
      ),
    ).toBe(v2Profile);
    expect(
      getOpenid4vciCredentialProfileByConfigurationId(
        'foundation.velocitynetwork.Employment.unknown',
        'Employment',
      ),
    ).toBeUndefined();
  });

  it('accepts neutral results only when they match the selected profile', () => {
    expect(() =>
      assertOpenid4vciIssuedCredential(
        {
          credentialFormat: 'vc+jwt',
          dataModelVersion: '2.0',
        },
        v2Profile,
      ),
    ).not.toThrow();
    expect(() =>
      assertOpenid4vciIssuedCredential(
        {
          credentialFormat: 'jwt_vc_json-ld',
          dataModelVersion: '1.1',
        },
        legacyProfile,
      ),
    ).not.toThrow();
    expect(() =>
      assertOpenid4vciIssuedCredential(
        {
          credentialFormat: 'jwt_vc_json-ld',
          dataModelVersion: '1.1',
        },
        v2Profile,
      ),
    ).toThrow('OpenID4VCI issuer returned an unsupported credential');
    expect(() => assertOpenid4vciIssuedCredential()).toThrow(
      'OpenID4VCI issuer returned an unsupported credential',
    );
  });
});
