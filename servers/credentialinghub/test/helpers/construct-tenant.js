/*
 * Copyright 2024 Velocity Team
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
const { generateKeyPair, KeyEncodings, KeyPurposes } = require('@verii/crypto');
const { nanoid } = require('nanoid');
const { omit } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { CihKeyPurposes } = require('../../src/entities/keys');

const constructTenant = async (persistTenant, persistKey) => {
  const tenant = await persistTenant({});
  const issuerKeyPair = generateKeyPair({ format: 'jwk' });
  const issuerKey = await persistKey({
    tenant,
    key: issuerKeyPair.privateKey,
  });
  const holderAccessTokensSecret = nanoid(16);
  const holderAccessTokensKey = await persistKey({
    tenant,
    purposes: [CihKeyPurposes.HOLDER_ACCESS_TOKENS],
    encoding: KeyEncodings.BASE64URL,
    secret: holderAccessTokensSecret,
  });
  tenant.keysByPurpose = {
    [KeyPurposes.DLT_TRANSACTIONS]: omit(
      ['encryptedJwk', 'purposes'],
      issuerKey,
    ),
    [KeyPurposes.ISSUING_METADATA]: omit(
      ['encryptedJwk', 'purposes'],
      issuerKey,
    ),
    [KeyPurposes.EXCHANGES]: omit(['encryptedJwk'], issuerKey),
    [CihKeyPurposes.HOLDER_ACCESS_TOKENS]: omit(
      ['encryptedJwk', 'encryptedSecret', 'purposes'],
      holderAccessTokensKey,
    ),
  };
  await mongoDb()
    .collection('tenants')
    .updateOne(
      { _id: new ObjectId(tenant._id) },
      {
        $set: {
          keysByPurpose: tenant.keysByPurpose,
        },
      },
    );
  return { tenant, issuerKeyPair, issuerKey, holderAccessTokensSecret };
};

module.exports = { constructTenant };
