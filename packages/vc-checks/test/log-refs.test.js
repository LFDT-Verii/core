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
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { generateCredentialJwt } = require('@verii/jwt');
const { generateKeyPair } = require('@verii/crypto');
const {
  credentialForLog,
  decodedJwtForLog,
  didDocumentForLog,
  issuerDependenciesForLog,
} = require('../src/log-refs');

describe('log refs', () => {
  const email = 'holder@example.com';

  it('credentialForLog keeps id, type and the issuer in its own shape', () => {
    const credential = {
      id: 'did:velocity:v2:0x1:1:1',
      type: ['EmailV1.0', 'VerifiableCredential'],
      issuer: { id: 'did:ion:issuer', name: 'Issuer', image: 'data:...' },
      credentialSubject: { email },
      contentHash: { type: 'VelocityContentHash2020', value: 'abc' },
    };

    expect(credentialForLog(credential)).toEqual({
      id: credential.id,
      type: credential.type,
      issuer: { id: 'did:ion:issuer' },
    });
    expect(
      credentialForLog({ ...credential, issuer: 'did:ion:issuer' }),
    ).toEqual({
      id: credential.id,
      type: credential.type,
      issuer: 'did:ion:issuer',
    });
    expect(credentialForLog(undefined)).toBeUndefined();
  });

  it('didDocumentForLog keeps each entry list under its own key as ids', () => {
    expect(
      didDocumentForLog({
        id: 'did:ion:issuer',
        alsoKnownAs: ['did:web:issuer.example.com'],
        publicKey: [{ id: '#key-1', publicKeyJwk: { kty: 'EC', x: 'x' } }],
        verificationMethod: [
          { id: '#key-2', type: 'JsonWebKey2020', publicKeyJwk: { kty: 'EC' } },
        ],
        service: [
          {
            id: '#service',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: 'https://issuer.example.com',
          },
        ],
      }),
    ).toEqual({
      id: 'did:ion:issuer',
      alsoKnownAs: ['did:web:issuer.example.com'],
      publicKey: [{ id: '#key-1' }],
      verificationMethod: [{ id: '#key-2', type: 'JsonWebKey2020' }],
      service: [{ id: '#service', type: 'VlcCareerIssuer_v1' }],
    });
  });

  it('decodedJwtForLog keeps the header and the issuer and id claims', () => {
    expect(
      decodedJwtForLog({
        header: { alg: 'ES256K', kid: 'did:ion:issuer#key-1', typ: 'JWT' },
        payload: {
          iss: 'did:ion:issuer',
          jti: 'urn:uuid:1',
          vc: { credentialSubject: { email } },
        },
      }),
    ).toEqual({
      header: { alg: 'ES256K', kid: 'did:ion:issuer#key-1', typ: 'JWT' },
      payload: { iss: 'did:ion:issuer', jti: 'urn:uuid:1' },
    });
    expect(decodedJwtForLog(null)).toBeNull();
  });

  it('issuerDependenciesForLog reduces each dependency and logs a missing one as null', async () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });
    const boundIssuerVc = await generateCredentialJwt(
      {
        type: ['CredentialMetadataListHeader'],
        issuer: 'did:ion:issuer',
        credentialSubject: { listId: 1, accountId: '0x1' },
      },
      privateKey,
      'did:ion:issuer#key-1',
    );

    const logged = issuerDependenciesForLog({
      boundIssuerVc,
      issuerAccreditation: {
        id: 'did:ion:issuer',
        permittedVelocityServiceCategory: ['Issuer'],
      },
      issuerDidDocument: undefined,
      credentialTypeMetadata: {
        credentialType: 'EmailV1.0',
        issuerCategory: 'ContactIssuer',
      },
    });

    expect(logged).toEqual({
      boundIssuerVc: {
        header: { alg: 'ES256K', kid: 'did:ion:issuer#key-1', typ: 'JWT' },
        payload: { iss: 'did:ion:issuer' },
      },
      issuerAccreditation: { id: 'did:ion:issuer' },
      issuerDidDocument: null,
      credentialTypeMetadata: { credentialType: 'EmailV1.0' },
    });
    expect(JSON.stringify(logged)).not.toContain(boundIssuerVc);
  });
});
