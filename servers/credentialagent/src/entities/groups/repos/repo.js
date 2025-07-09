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

const { repoFactory } = require('@spencejs/spence-mongo-repos');
const { updateOrErrorExtension } = require('./update-or-error-extension');
const { deleteTenantExtension } = require('./delete-tenant-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'groups',
      entityName: 'group',
      defaultProjection: {
        _id: 1,
        slug: 1,
        dids: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [updateOrErrorExtension, deleteTenantExtension],
    },
    app
  );
};
