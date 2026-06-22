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

const {
  mongoDb,
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const { findersExtension } = require('./finders-extension');
const { addVerificationExtension } = require('./add-verification');

module.exports = (app, options, next = () => {}) => {
  app.ready(async () => {
    await mongoDb()
      .collection('presentations')
      .createIndex({ tenantId: 1, depotId: 1 });
    await mongoDb()
      .collection('presentations')
      .createIndex({ tenantId: 1, exchangeId: 1 });
  });
  next();
  return repoFactory({
    name: 'presentations',
    entityName: 'presentation',
    defaultProjection: {
      _id: 1,
      format: 1,
      presentation: 1,
      verifications: 1,
      exchangeId: 1,
      depotId: 1,
      tenantId: 1,
      createdAt: 1,
      updatedAt: 1,
    },
    extensions: [
      autoboxIdsExtension,
      multitenantExtension(),
      findersExtension,
      addVerificationExtension,
    ],
  });
};
