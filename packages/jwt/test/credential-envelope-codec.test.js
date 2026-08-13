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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { decodeCredentialEnvelope } = require('..');
const {
  compactCredentialFixture,
  legacyCredentialFixtures,
  legacyPayload,
  VC_V2_CONTEXT,
  v2Credential,
  v2CredentialFixture,
} = require('./fixtures/credential-envelope-fixtures');

describe('credential envelope classification', () => {
  it('classifies a direct VC 2.0 payload', () => {
    expect(typeof decodeCredentialEnvelope).toBe('function');
    expect(decodeCredentialEnvelope(v2CredentialFixture)).toEqual({
      compact: v2CredentialFixture,
      credential: v2Credential,
      dataModelVersion: '2.0',
      envelopeFormat: 'vc+jwt',
      protectedHeader: {
        alg: 'ES256',
        cty: 'vc',
        kid: 'did:velocity:v2:credential-123#key-1',
        typ: 'vc+jwt',
      },
    });
  });

  it('classifies a historical VC 1.1 envelope', () => {
    expect(typeof decodeCredentialEnvelope).toBe('function');
    expect(
      decodeCredentialEnvelope(legacyCredentialFixtures[0].compact),
    ).toEqual(
      expect.objectContaining({
        compact: legacyCredentialFixtures[0].compact,
        dataModelVersion: '1.1',
        envelopeFormat: 'jwt_vc_json-ld',
      }),
    );
  });

  it('rejects a VC 2.0 document nested in the legacy vc claim', () => {
    expect(typeof decodeCredentialEnvelope).toBe('function');
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { vc: { ...legacyPayload.vc, '@context': [VC_V2_CONTEXT] } },
    );

    expect(() => decodeCredentialEnvelope(compact)).toThrow();
  });

  it('rejects mixed direct and nested credential signals', () => {
    expect(typeof decodeCredentialEnvelope).toBe('function');
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { ...v2Credential, vc: legacyPayload.vc },
    );

    expect(() => decodeCredentialEnvelope(compact)).toThrow();
  });
});
