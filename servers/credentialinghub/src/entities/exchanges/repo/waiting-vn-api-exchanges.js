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
const { map } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { ExchangeProtocols, ExchangeStates } = require('../domain');

// A VN API exchange waits on its depot from OFFERS_WAITING until it starts claiming or is COMPLETE.
const waitingFilter = {
  'protocolMetadata.protocol': ExchangeProtocols.VN_API,
  'events.state': {
    $eq: ExchangeStates.OFFERS_WAITING,
    $nin: [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
  },
};

const waitingVnApiExchangesExtension = (parent) => ({
  findWaitingVnApiExchange: (depotId, projection) =>
    parent.findLatestVnApiExchangeByDepotId(depotId, projection, waitingFilter),
  // Oldest first, so the latest of a depot's waiting exchanges comes last
  findWaitingVnApiExchanges: (depotIds, projection) =>
    parent.find(
      {
        filter: {
          ...waitingFilter,
          depotId: { $in: map((depotId) => new ObjectId(depotId), depotIds) },
        },
        sort: { createdAt: 1, _id: 1 },
      },
      projection,
    ),
  // Latest wins: when an exchange starts waiting, the depot's older waiting exchanges are completed.
  // Two exchanges that start waiting at once can't complete each other, so the newer one keeps waiting.
  completeOlderWaitingVnApiExchanges: ({ _id, depotId }) =>
    parent.collection().updateMany(
      parent.prepFilter({
        ...waitingFilter,
        depotId: new ObjectId(depotId),
        _id: { $lt: new ObjectId(_id) },
      }),
      {
        $push: {
          events: { state: ExchangeStates.COMPLETE, timestamp: new Date() },
        },
      },
    ),
  extensions: parent.extensions.concat(['waitingVnApiExchangesExtension']),
});

module.exports = { waitingVnApiExchangesExtension };
