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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { decryptCollection } = require('@verii/crypto');

const initFindKmsKey = (fastify) => async (filter) => {
  const key = await mongoDb()
    .collection('keys')
    .findOne(filter, {
      projection: { kidFragment: 1, key: 1 },
    });
  key.key = JSON.parse(decryptCollection(key.key, fastify.config.mongoSecret));
  return key;
};

module.exports = { initFindKmsKey };
