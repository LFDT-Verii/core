/**
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
 */

const { isEmpty, map } = require('lodash/fp');
const { ObjectId } = require('mongodb');

const findDepotsExtension = (parent) => ({
  findDepots: async (serviceId, depotIds) => {
    const filter = {};
    if (serviceId) {
      filter.serviceId = new ObjectId(serviceId);
    }
    if (!isEmpty(depotIds)) {
      filter._id = { $in: map((id) => new ObjectId(id), depotIds) };
    }
    return parent.find({ filter });
  },
  extensions: parent.extensions.concat(['findDepotsExtension']),
});

module.exports = { findDepotsExtension };
