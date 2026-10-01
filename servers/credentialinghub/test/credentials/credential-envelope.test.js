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
  buildIssuedCredentialEnvelope,
  inferCredentialEnvelopeMetadata,
} = require('../../src/entities/credentials');

describe('credential envelope persistence metadata', () => {
  it('maps an issued credential without decoding its secured value', () => {
    const credentialStatus = { id: 'https://example.com/status/1' };

    expect(
      buildIssuedCredentialEnvelope({
        credential: buildCredential({
          context: 'https://www.w3.org/ns/credentials/v2',
          credentialStatus,
        }),
        credentialFormat: 'vc+jwt',
        credentialId: 'did:test:credential',
        credentialStatus,
        dataModelVersion: '2.0',
        securedCredential: 'intentionally-not-decodable',
        securingMechanism: { algorithm: 'ES256', type: 'jose' },
      }),
    ).toEqual({
      credentialDid: 'did:test:credential',
      credentialStatus,
      dataModelVersion: '2.0',
      envelopeFormat: 'vc+jwt',
      jwtVc: 'intentionally-not-decodable',
      signingAlgorithm: 'ES256',
    });
  });

  it('rejects incomplete or unsupported issued credentials', () => {
    const completeResult = {
      credentialFormat: 'vc+jwt',
      credentialId: 'did:test:credential',
      dataModelVersion: '2.0',
      securedCredential: 'intentionally-not-decodable',
      securingMechanism: { algorithm: 'ES256', type: 'jose' },
    };

    expect(() => buildIssuedCredentialEnvelope(null)).toThrow(
      'Issued credential envelope is missing credential id',
    );
    expect(() =>
      buildIssuedCredentialEnvelope({
        ...completeResult,
        securedCredential: undefined,
      }),
    ).toThrow('Issued credential envelope is missing secured credential');
    expect(() =>
      buildIssuedCredentialEnvelope({
        ...completeResult,
        credentialFormat: 'unknown',
      }),
    ).toThrow('Issued credential has an unsupported format');
    expect(() =>
      buildIssuedCredentialEnvelope({
        ...completeResult,
        dataModelVersion: '3.0',
      }),
    ).toThrow('Issued credential has an unsupported data model version');
    expect(() =>
      buildIssuedCredentialEnvelope({
        ...completeResult,
        securingMechanism: { algorithm: 'EdDSA', type: 'jose' },
      }),
    ).toThrow('Issued credential has an unsupported securing mechanism');
  });

  it('infers only missing metadata without persisting or replacing known values', () => {
    const jwtVc = buildCompact(
      { alg: 'ES256K', typ: 'JWT' },
      {
        jti: 'did:test:credential',
        vc: buildCredential({
          context: 'https://www.w3.org/2018/credentials/v1',
        }),
      },
    );
    const credential = {
      dataModelVersion: 'recorded-version',
      envelopeFormat: null,
      jwtVc,
      signingAlgorithm: undefined,
    };

    expect(inferCredentialEnvelopeMetadata(credential)).toEqual({
      dataModelVersion: 'recorded-version',
      envelopeFormat: 'jwt_vc_json-ld',
      jwtVc,
      signingAlgorithm: 'ES256K',
    });
  });

  it('does not decode records that already have complete metadata', () => {
    const credential = {
      dataModelVersion: '1.1',
      envelopeFormat: 'jwt_vc_json-ld',
      jwtVc: 'invalid',
      signingAlgorithm: 'ES256K',
    };

    expect(inferCredentialEnvelopeMetadata(credential)).toBe(credential);
  });

  it('leaves missing and invalid pre-migration compact values readable', () => {
    const missingCompact = {
      dataModelVersion: null,
      id: 'missing-compact',
      signingAlgorithm: 'stored-algorithm',
    };
    const invalidCompact = {
      envelopeFormat: null,
      id: 'invalid-compact',
      jwtVc: 'invalid',
      signingAlgorithm: 'stored-algorithm',
    };

    expect(inferCredentialEnvelopeMetadata(missingCompact)).toEqual({
      id: 'missing-compact',
      signingAlgorithm: 'stored-algorithm',
    });
    expect(inferCredentialEnvelopeMetadata(invalidCompact)).toEqual({
      id: 'invalid-compact',
      jwtVc: 'invalid',
      signingAlgorithm: 'stored-algorithm',
    });
  });
});

const buildCompact = (header, payload) =>
  [header, payload, 'signature']
    .map((value) =>
      Buffer.from(
        typeof value === 'string' ? value : JSON.stringify(value),
      ).toString('base64url'),
    )
    .join('.');

const buildCredential = ({ context, credentialStatus }) => ({
  '@context': [context],
  credentialStatus,
  credentialSubject: { id: 'did:test:holder' },
  id: 'did:test:credential',
  issuer: { id: 'did:test:issuer' },
  type: ['VerifiableCredential', 'Employment'],
});
