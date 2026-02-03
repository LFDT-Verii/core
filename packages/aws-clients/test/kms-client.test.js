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
const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const {
  KMSClient,
  CreateKeyCommand,
  CreateAliasCommand,
  DeleteAliasCommand,
  DecryptCommand,
} = require('@aws-sdk/client-kms');
const { generateKeyPair } = require('@verii/crypto');
const { hexFromJwk } = require('@verii/jwt');
const { initKmsClient } = require('../src/kms-client');

describe('kms-client test suite', () => {
  const aliasName = 'alias/my-key-alias';
  const config = {
    awsRegion: 'us-west-1',
    awsEndpoint: 'http://localhost:4566',
  };
  const kmsClient = initKmsClient(config);

  const testClient = new KMSClient({
    credentials: {
      accessKeyId: 'tests-key-id',
      secretAccessKey: 'tests-key',
    },
    region: 'us-west-1',
    endpoint: 'http://localhost:4566',
  });

  before(async () => {
    const createKeyResponse = await testClient.send(new CreateKeyCommand());
    const createAliasParams = {
      AliasName: aliasName,
      TargetKeyId: createKeyResponse.KeyMetadata.Arn,
    };
    await testClient.send(new CreateAliasCommand(createAliasParams));
  });

  after(async () => {
    await testClient.send(new DeleteAliasCommand({ AliasName: aliasName }));
  });

  describe('encrypt', () => {
    it('should throw error if argument keyId is missing', async () => {
      await expect(kmsClient.encrypt(undefined, 'secret-text')).rejects.toThrow(
        "exception while calling kms.Encrypt: expected string or bytes-like object, got 'NoneType'",
      );
    });

    it('should throw error if argument plaintext is missing', async () => {
      await expect(kmsClient.encrypt(aliasName, undefined)).rejects.toThrow(
        'The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received undefined',
      );
    });

    it('should encrypt plainttext', async () => {
      const { privateKey } = await generateKeyPair({
        format: 'jwk',
        curve: 'P-256',
      });
      const response = await kmsClient.encrypt(
        aliasName,
        hexFromJwk(privateKey),
      );
      expect(response.CiphertextBlob).toBeDefined();
      expect(response.CiphertextBlob.toString()).not.toBe(
        hexFromJwk(privateKey),
      );
      const decryptResult = await testClient.send(
        new DecryptCommand({
          CiphertextBlob: response.CiphertextBlob,
        }),
      );

      expect(Buffer.from(decryptResult.Plaintext).toString()).toEqual(
        hexFromJwk(privateKey),
      );
    });
  });

  describe('decrypt', () => {
    it('should throw error if argument ciphertext is missing', async () => {
      await expect(kmsClient.decrypt(undefined)).rejects.toThrow(
        "LocalStack is unable to deserialize the ciphertext blob. Perhaps the blob didn't come from LocalStack",
      );
    });

    it('should decrypt ciphertext', async () => {
      const { privateKey } = await generateKeyPair({
        format: 'jwk',
        curve: 'P-256',
      });
      const response = await kmsClient.encrypt(
        aliasName,
        hexFromJwk(privateKey),
      );
      const decryptResult = await kmsClient.decrypt(response.CiphertextBlob);
      expect(decryptResult.Plaintext.toString()).toEqual(
        hexFromJwk(privateKey),
      );
    });
  });
});
