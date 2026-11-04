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
const { flow, keyBy, map, mapValues } = require('lodash/fp');

// Each depot carries the ID of the VN API exchange waiting on it, if there is one.
const getDepots = async (serviceId, depotIds, { repos }) => {
  const depots = await repos.depots.findDepots(serviceId, depotIds);
  const waitingExchanges = await repos.exchanges.findWaitingVnApiExchanges(
    map('_id', depots),
    { _id: 1, depotId: 1 },
  );
  const waitingExchangeIds = flow(
    keyBy(({ depotId }) => `${depotId}`),
    mapValues(({ _id }) => `${_id}`),
  )(waitingExchanges);
  return map(
    (depot) => ({
      ...depot,
      waitingExchangeId: waitingExchangeIds[`${depot._id}`],
    }),
    depots,
  );
};

module.exports = { getDepots };
