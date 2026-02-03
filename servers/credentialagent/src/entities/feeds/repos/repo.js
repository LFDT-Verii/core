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
const {
  multitenantExtension,
  refreshTokenExtension,
} = require('@verii/spencer-mongo-extensions');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'feeds',
      entityName: 'feed',
      defaultProjection,
      extensions: [
        autoboxIdsExtension,
        multitenantExtension(),
        refreshTokenExtension,
        feedExtensions,
      ],
    },
    app,
  );
};

const defaultProjection = {
  _id: 1,
  feedTimestamp: 1,
  clientId: 1,
  vendorUserId: 1,
  preauthCode: 1,
  refreshToken: 1,
  createdAt: 1,
  updatedAt: 1,
};

const feedExtensions = (parent, context) => {
  return {
    prepFilter: (filter) => {
      const preppedFilter = {
        ...filter,
      };
      if (context.disclosure) {
        preppedFilter.disclosureId = context.disclosure._id;
      }

      return parent.prepFilter(preppedFilter);
    },
    prepModification: (val, ...args) => {
      const preppedModification = {
        ...val,
      };
      if (context.disclosure) {
        preppedModification.disclosureId = context.disclosure._id;
      }
      return parent.prepModification(preppedModification, ...args);
    },
    updateLatestFeedTimestamp: async (filter) => {
      const preppedFilter = parent.prepFilter(filter);
      const t = new Date();
      const updateDoc = {
        $set: { feedTimestamp: t, updatedAt: t },
      };
      const updateResult = await parent
        .collection()
        .findOneAndUpdate(preppedFilter, updateDoc, {
          projection: defaultProjection,
          returnDocument: 'after',
          includeResultMetadata: true,
          sort: {
            updatedAt: -1,
          },
        });
      return updateResult.value;
    },
  };
};
