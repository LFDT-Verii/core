/*
 * Copyright 2025 Velocity Team
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
const { generateKeyPair } = require('@verii/crypto');
const { register } = require('@spencejs/spence-factories');
const { kmsRepo } = require('@verii/db-kms');

module.exports = (app) =>
  register('kms', kmsRepo(app)({ config: app.config }), async (overrides) => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    return {
      publicJwk: keyPair.publicKey,
      privateJwk: keyPair.privateKey,
      algorithm: 'ec',
      curve: 'secp256k1',
      ...overrides(),
    };
  });
