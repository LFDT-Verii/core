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
const { KeyAlgorithms } = require('@verii/crypto');
const { CredentialEnvelopeFormats } = require('@verii/jwt');
const { ALG_TYPE } = require('@verii/metadata-registration');
const {
  CredentialSigningAlgorithms,
  getCredentialSigningProfile,
} = require('../src/credential-signing-profile');
const { prepareCredentials } = require('../src/domain/prepare-credentials');
const { calcAlgTypeName } = require('../src/utils/calc-alg-type-name');
const { credentialTypesMap } = require('./helpers/credential-types-map');
const { createExampleDid } = require('./helpers/create-example-did');
const { offerFactory } = require('./helpers/offer-factory');

describe('credential signing algorithm guardrails', () => {
  it('preserves the metadata encoding for every signing algorithm', () => {
    expect(
      [KeyAlgorithms.SECP256K1, KeyAlgorithms.ES256, KeyAlgorithms.RS256].map(
        (defaultSignatureAlgorithm) =>
          calcAlgTypeName({ defaultSignatureAlgorithm }),
      ),
    ).toEqual(['HEX_AES_256', 'COSEKEY_AES_256', 'COSEKEY_AES_256']);
  });

  it('defines one complete execution profile for every allowed key algorithm', () => {
    expect(CredentialSigningAlgorithms).toEqual([
      KeyAlgorithms.SECP256K1,
      KeyAlgorithms.ES256,
      KeyAlgorithms.RS256,
    ]);
    expect(getCredentialSigningProfile(KeyAlgorithms.SECP256K1)).toEqual({
      algType: ALG_TYPE.HEX_AES_256,
      joseAlgorithm: 'ES256K',
      keyAlgorithm: KeyAlgorithms.SECP256K1,
    });
    expect(getCredentialSigningProfile('ES256')).toEqual({
      algType: ALG_TYPE.COSEKEY_AES_256,
      joseAlgorithm: 'ES256',
      keyAlgorithm: KeyAlgorithms.ES256,
    });
    expect(getCredentialSigningProfile('RS256')).toEqual({
      algType: ALG_TYPE.COSEKEY_AES_256,
      joseAlgorithm: 'RS256',
      keyAlgorithm: KeyAlgorithms.RS256,
    });
  });

  it('rejects an algorithm outside the tenant policy allowlist', () => {
    expect(() => getCredentialSigningProfile('EdDSA')).toThrow(
      'Credential signing algorithm is not supported: EdDSA',
    );
  });

  it('rejects a metadata allocation for the wrong encoding profile', async () => {
    await expect(
      prepareCredential('ES256', { algType: 'aes-256-gcm' }),
    ).rejects.toThrow('Credential metadata algorithm does not match ES256');
  });

  it('returns a format-neutral prepared credential result', async () => {
    const [preparedCredential] = await prepareCredential(
      KeyAlgorithms.SECP256K1,
      { algType: 'aes-256-gcm', index: 2, listId: 1 },
    );

    expect(preparedCredential).toEqual({
      issuedCredential: expect.objectContaining({
        credential: expect.objectContaining({
          id: expect.any(String),
        }),
        credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
        securedCredential: expect.any(String),
      }),
      metadata: expect.objectContaining({
        credentialType: 'EmailV1.0',
      }),
    });
  });
});

const prepareCredential = (
  algorithm,
  metadataEntry = { algType: 'cosekey:aes-256-gcm', index: 2, listId: 1 },
) =>
  prepareCredentials({
    context: {
      config: {
        credentialExtensionsContextUrl:
          'https://example.com/credential-extensions.json',
        includeContentHashInCredentialId: true,
        revocationContractAddress: '0x1234',
      },
    },
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    credentialSigningAlgorithms: [algorithm],
    credentialSubjectId: createExampleDid(),
    credentialTypesMap,
    issuer: {
      did: createExampleDid(),
      dltPrimaryAddress: '0x00112233445566778899aabbccddeeff00112233',
    },
    metadataEntries: [metadataEntry],
    offers: [offerFactory({ credentialType: 'EmailV1.0' })],
    revocationListEntries: [{ index: 4, listId: 3 }],
  });
