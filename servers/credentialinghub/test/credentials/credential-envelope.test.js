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
  it('maps a legacy compact credential into neutral persistence fields', () => {
    const credentialStatus = { id: 'https://example.com/status/1' };
    const jwtVc = buildCompact(
      { alg: 'RS256', typ: 'JWT' },
      {
        jti: 'did:test:credential',
        vc: buildCredential({
          context: 'https://www.w3.org/2018/credentials/v1',
          credentialStatus,
        }),
      },
    );

    expect(buildIssuedCredentialEnvelope(jwtVc)).toEqual({
      credentialDid: 'did:test:credential',
      credentialStatus,
      dataModelVersion: '1.1',
      envelopeFormat: 'jwt_vc_json-ld',
      jwtVc,
      signingAlgorithm: 'RS256',
    });
  });

  it('maps a direct VC 2.0 compact credential without a payload.vc assumption', () => {
    const jwtVc = buildCompact(
      { alg: 'ES256', cty: 'vc', typ: 'vc+jwt' },
      buildCredential({ context: 'https://www.w3.org/ns/credentials/v2' }),
    );

    expect(buildIssuedCredentialEnvelope(jwtVc)).toEqual({
      credentialDid: 'did:test:credential',
      credentialStatus: undefined,
      dataModelVersion: '2.0',
      envelopeFormat: 'vc+jwt',
      jwtVc,
      signingAlgorithm: 'ES256',
    });
  });

  it('rejects an issued compact credential without a credential id', () => {
    const credential = buildCredential({
      context: 'https://www.w3.org/2018/credentials/v1',
    });
    delete credential.id;

    expect(() =>
      buildIssuedCredentialEnvelope(
        buildCompact({ alg: 'ES256K', typ: 'JWT' }, { vc: credential }),
      ),
    ).toThrow('Issued credential envelope is missing credential id');
  });

  it('rejects an issued compact credential without a signing algorithm', () => {
    expect(() =>
      buildIssuedCredentialEnvelope(
        buildCompact(
          { typ: 'JWT' },
          {
            vc: buildCredential({
              context: 'https://www.w3.org/2018/credentials/v1',
            }),
          },
        ),
      ),
    ).toThrow('Credential envelope protected header requires alg');
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
