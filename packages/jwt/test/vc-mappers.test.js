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
const { omit } = require('lodash/fp');
const { jsonLdToUnsignedVcJwtContent } = require('../src/vc-mappers');
const {
  maximalJsonLdCredential,
  minimalJsonLdCredential,
} = require('./helpers/minimal-jsonld-credential');

describe('Generate a W3C VC-JWT v1.1 from a jsonld vc', () => {
  it('should generate the payload and header from a minimal credential', () => {
    expect(
      jsonLdToUnsignedVcJwtContent(
        minimalJsonLdCredential,
        'did:example#key-id'
      )
    ).toEqual({
      header: { typ: 'JWT', kid: 'did:example#key-id' },
      payload: {
        vc: minimalJsonLdCredential,
        jti: minimalJsonLdCredential.id,
        iss: minimalJsonLdCredential.issuer.id,
        iat: expect.any(Number),
        nbf: expect.any(Number),
      },
    });
  });

  it('should generate the payload and header from a maximal credential', () => {
    expect(
      jsonLdToUnsignedVcJwtContent(
        maximalJsonLdCredential,
        'did:example#key-id'
      )
    ).toEqual({
      header: { typ: 'JWT', kid: 'did:example#key-id' },
      payload: {
        vc: omit(['credentialSubject.jwk'], maximalJsonLdCredential),
        iat: Date.parse(maximalJsonLdCredential.issuanceDate) / 1000,
        nbf: Date.parse(maximalJsonLdCredential.issuanceDate) / 1000,
        exp: Date.parse(maximalJsonLdCredential.expirationDate) / 1000,
        iss: maximalJsonLdCredential.issuer.id,
        jti: maximalJsonLdCredential.id,
        sub: maximalJsonLdCredential.credentialSubject.id,
        sub_jwk: maximalJsonLdCredential.credentialSubject.jwk,
      },
    });
  });
});
