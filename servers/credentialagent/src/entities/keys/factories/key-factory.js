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
} = require('@verii/crypto');
const { ObjectId } = require('mongodb');
const { defaultRepoOptions, kmsRepo } = require('@verii/db-kms');
const { initTenantFactory } = require('../../tenants');
const { agentKmsOptions } = require('../../../plugins/kms-plugin');

const initKeysFactory = (app) => {
  const initRepo = kmsRepo(app, { ...defaultRepoOptions, ...agentKmsOptions });

  return register('key', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const keyPair = await getOrBuild('keyPair', () =>
      generateKeyPair({ format: 'jwk' })
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
        key: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        ...overrides(),
      },
      repo: initRepo({
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
        config: app.config,
      }),
    };
  });
};

module.exports = { initKeysFactory };
