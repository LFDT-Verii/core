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
const { ObjectId } = require('mongodb');

// $in with array elements compares whole arrays, so a depot matches only when
// its authMatchValues equal one of the tuples exactly, in order.
const findDepotsByAuthMatchTuplesExtension = (parent) => ({
  findDepotsByAuthMatchTuples: (serviceId, tuples) =>
    parent.find({
      filter: {
        serviceId: new ObjectId(serviceId),
        authMatchValues: { $in: tuples },
      },
    }),
  extensions: parent.extensions.concat([
    'findDepotsByAuthMatchTuplesExtension',
  ]),
});

module.exports = { findDepotsByAuthMatchTuplesExtension };
