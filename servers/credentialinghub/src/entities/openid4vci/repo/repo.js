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
 *
 */
const {
  mongoDb,
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const { findersExtension } = require('./finders-extension');

// One document per credential issued through OpenID4VCI. Only the OpenID4VCI
// credential and notification endpoints write it, on the holder's behalf.
module.exports = (app, options, next = () => {}) => {
  app.ready(async () => {
    await mongoDb()
      .collection('openid4vciTransactions')
      .createIndex({ tenantId: 1, notificationId: 1 });
    await mongoDb()
      .collection('openid4vciTransactions')
      .createIndex({ tenantId: 1, credentialId: 1 });
  });
  next();
  return repoFactory(
    {
      name: 'openid4vciTransactions',
      entityName: 'openid4vciTransaction',
      defaultProjection: {
        _id: 1,
        tenantId: 1,
        depotId: 1,
        serviceId: 1,
        credentialId: 1,
        credentialSubjectId: 1,
        notificationId: 1,
        status: 1,
        credentialMetadata: 1,
        acceptedAt: 1,
        err: 1,
        errorCode: 1,
        errorDescription: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [
        autoboxIdsExtension,
        multitenantExtension(),
        findersExtension,
      ],
    },
    app,
  );
};
