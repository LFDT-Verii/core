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

const {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} = require('@aws-sdk/client-kms');
const { buildClientConfig } = require('./client-config');

const initKmsClient = ({ awsRegion, awsEndpoint }) => {
  const kmsClient = new KMSClient(
    buildClientConfig({
      awsRegion,
      awsEndpoint,
    })
  );

  const encrypt = async (keyId, plaintext) => {
    const command = new EncryptCommand({
      KeyId: keyId,
      Plaintext: Buffer.from(plaintext),
    });

    return kmsClient.send(command);
  };

  const decrypt = async (ciphertextBlob) => {
    const command = new DecryptCommand({
      CiphertextBlob: ciphertextBlob,
    });

    const result = await kmsClient.send(command);

    return {
      ...result,
      Plaintext: Buffer.from(result.Plaintext),
    };
  };

  return {
    encrypt,
    decrypt,
  };
};

module.exports = {
  initKmsClient,
};
