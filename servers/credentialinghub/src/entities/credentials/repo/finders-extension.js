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

const { flow, flatMapDeep, compact, map, uniq, isEmpty } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { claimableCredentialFilter } = require('./claimable-credential-filter');

const findersExtension = (parent) => ({
  search: async ({ credentialIds }) => {
    const filter = {};
    if (!isEmpty(credentialIds)) {
      filter._id = {
        $in: map((credentialId) => new ObjectId(credentialId), credentialIds),
      };
    }
    return parent.find({ filter });
  },
  findByDepotId: async ({
    depotId,
    omitContentHashes,
    credentialTypes,
    claimable,
  }) => {
    const filter = {
      depotId: new ObjectId(depotId),
    };
    if (!isEmpty(omitContentHashes)) {
      filter.contentHash = { $nin: omitContentHashes };
    }
    if (!isEmpty(credentialTypes)) {
      filter['content.type'] = { $in: credentialTypes };
    }
    if (claimable === true) {
      Object.assign(filter, claimableCredentialFilter);
    }
    return parent.find({ filter });
  },
  findByRelatedResources: async (credentials) => {
    const identifiers = flow(
      flatMapDeep(({ content }) => [
        map('id', content.relatedResource),
        map('id', content.replaces),
      ]),
      compact,
      uniq,
    )(credentials);

    if (isEmpty(identifiers)) {
      return [];
    }

    return parent.find(
      {
        filter: {
          did: { $in: identifiers },
        },
      },
      {
        id: 1,
        did: 1,
        content: 1,
        digestSRI: 1,
        linkCode: 1,
      },
    );
  },
  findByIdInDepot: async (credentialId, depotId) =>
    parent.findOne({
      filter: { _id: credentialId, depotId: new ObjectId(depotId) },
    }),
  findByNotificationId: async (notificationId, depotId) =>
    parent.findOne(
      {
        filter: {
          'exchange.id': notificationId,
          depotId: new ObjectId(depotId),
        },
      },
      { exchange: 1 },
    ),
  findNonFinal: async (credentialIds, depotId) =>
    parent.find({
      filter: {
        _id: { $in: credentialIds },
        depotId: new ObjectId(depotId),
        ...claimableCredentialFilter,
      },
    }),
  extensions: parent.extensions.concat(['findersExtension']),
});

module.exports = {
  findersExtension,
};
