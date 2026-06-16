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

const { ObjectId } = require('mongodb');
const { isEmpty, map } = require('lodash/fp');

const findersExtension = (parent) => ({
  search: async ({ presentationIds, exchangeId, depotId }) => {
    const filter = {};
    if (!isEmpty(presentationIds)) {
      filter._id = {
        $in: map((id) => new ObjectId(id), presentationIds),
      };
    }
    if (exchangeId) {
      filter.exchangeId = new ObjectId(exchangeId);
    }
    if (depotId) {
      filter.depotId = new ObjectId(depotId);
    }

    return parent.find({ filter });
  },
  findByDepotId: async ({ depotId }) => {
    const filter = {
      depotId: new ObjectId(depotId),
    };

    return parent.find({ filter });
  },
  extensions: parent.extensions.concat(['findersExtension']),
});

module.exports = {
  findersExtension,
};
