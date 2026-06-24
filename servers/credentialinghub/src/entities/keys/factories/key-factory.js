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

const { register } = require('@spencejs/spence-factories');
const {
  KeyPurposes,
  KeyAlgorithms,
  KeyEncodings,
  generateKeyPair,
  publicKeyFromPrivateKey,
} = require('@verii/crypto');
const { ObjectId } = require('mongodb');

const { kmsRepo, defaultRepoOptions } = require('@verii/db-kms');
const { initTenantFactory } = require('../../tenants/factories');
const { kmsRepoOptions } = require('../plugins');

const initKeyFactory = (app) => {
  const initRepo = kmsRepo(app, { ...defaultRepoOptions, ...kmsRepoOptions });
  return register('key', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const privateJwk = await getOrBuild(
      'key',
      () => generateKeyPair({ format: 'jwk' }).privateKey,
    );
    return {
      item: {
        purposes: [
          KeyPurposes.DLT_TRANSACTIONS,
          KeyPurposes.ISSUING_METADATA,
          KeyPurposes.EXCHANGES,
        ],
        algorithm: KeyAlgorithms.SECP256K1,
        encoding: KeyEncodings.JWK,
        kidFragment: '#velocity-key-1',
        tenantId: new ObjectId(tenant._id),
        publicJwk: publicKeyFromPrivateKey(privateJwk),
        jwk: privateJwk,
        ...overrides(),
      },
      repo: initRepo({
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
        config: app.config,
      }),
    };
  });
};

module.exports = { initKeyFactory };
