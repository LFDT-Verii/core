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

const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const crypto = require('@verii/crypto');

const mockGenerateJWAKeyPair = mock.fn(crypto.generateJWAKeyPair);

mock.module('@verii/crypto', {
  namedExports: {
    ...crypto,
    generateJWAKeyPair: mockGenerateJWAKeyPair,
  },
});

const { KeyAlgorithms } = crypto;
const { prepareJwtVcs } = require('../src/domain/prepare-jwt-vcs');
const { calcAlgTypeName } = require('../src/utils/calc-alg-type-name');
const { credentialTypesMap } = require('./helpers/credential-types-map');
const { createExampleDid } = require('./helpers/create-example-did');
const { offerFactory } = require('./helpers/offer-factory');

const keyPairs = {
  ES256: crypto.generateJWAKeyPair(KeyAlgorithms.ES256),
  ES256K: crypto.generateJWAKeyPair(KeyAlgorithms.SECP256K1),
  RS256: crypto.generateJWAKeyPair(KeyAlgorithms.RS256),
};

describe('credential signing algorithm guardrails', () => {
  beforeEach(() => {
    mockGenerateJWAKeyPair.mock.resetCalls();
    mockGenerateJWAKeyPair.mock.mockImplementation(crypto.generateJWAKeyPair);
  });

  it('preserves the metadata encoding for every signing algorithm', () => {
    expect(
      [KeyAlgorithms.SECP256K1, KeyAlgorithms.ES256, KeyAlgorithms.RS256].map(
        (defaultSignatureAlgorithm) =>
          calcAlgTypeName({ defaultSignatureAlgorithm }),
      ),
    ).toEqual(['HEX_AES_256', 'COSEKEY_AES_256', 'COSEKEY_AES_256']);
  });

  for (const [title, algorithm, keyPair] of [
    ['ES256K with P-256', 'ES256K', keyPairs.ES256],
    ['ES256 with secp256k1', 'ES256', keyPairs.ES256K],
    ['RS256 with EC', 'RS256', keyPairs.ES256],
    [
      'ES256 with different public and private keys',
      'ES256',
      {
        privateKey: keyPairs.ES256.privateKey,
        publicKey: crypto.generateJWAKeyPair(KeyAlgorithms.ES256).publicKey,
      },
    ],
    [
      'ES256 with a non-signing public key',
      'ES256',
      {
        privateKey: keyPairs.ES256.privateKey,
        publicKey: { ...keyPairs.ES256.publicKey, use: 'enc' },
      },
    ],
  ]) {
    it(`rejects ${title} before producing a credential`, async () => {
      mockGenerateJWAKeyPair.mock.mockImplementation(() => keyPair);

      await expect(prepareCredential(algorithm)).rejects.toThrow(
        `Credential signing key pair is not valid for ${algorithm}`,
      );
    });
  }
});

const prepareCredential = (algorithm) =>
  prepareJwtVcs(
    [offerFactory({ credentialType: 'EmailV1.0' })],
    createExampleDid(),
    {
      did: createExampleDid(),
      dltPrimaryAddress: '0x00112233445566778899aabbccddeeff00112233',
    },
    [{ algType: 'unused', index: 2, listId: 1 }],
    [{ index: 4, listId: 3 }],
    credentialTypesMap,
    {
      config: {
        credentialExtensionsContextUrl:
          'https://example.com/credential-extensions.json',
        includeContentHashInCredentialId: true,
        revocationContractAddress: '0x1234',
      },
    },
    [algorithm],
  );
