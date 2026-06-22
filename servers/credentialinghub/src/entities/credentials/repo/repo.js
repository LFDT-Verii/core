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
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const { findersExtension } = require('./finders-extension');
const { updateExtensions } = require('./update-issued-credential');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'credentials',
      entityName: 'credential',
      defaultProjection: {
        _id: 1,
        did: 1,
        credentialReference: 1,
        content: 1,
        contentHash: 1,
        digestSRI: 1,
        tags: 1,
        acceptedAt: 1,
        jwtVc: 1,
        rejectedAt: 1,
        failedAt: 1,
        deletedAt: 1,
        rejectedReason: 1,
        typeMetadata: 1,
        openid4vcMetadata: 1,
        error: 1,
        depotId: 1,
        tenantId: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [
        autoboxIdsExtension,
        multitenantExtension(),
        findersExtension,
        updateExtensions,
      ],
    },
    app,
  );
};
