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

const { each } = require('lodash/fp');

module.exports = {
  up: async (db) => {
    const tenantCollection = await db.collection('tenants');
    const results = await tenantCollection.aggregate([
      { $group: { _id: '$did', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
      { $project: { did: '$_id', _id: 0 } },
    ]);
    const resultsArray = await results.toArray();
    if (resultsArray.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`${resultsArray.length} duplicates found.`);
      // eslint-disable-next-line no-console
      console.log(
        'Please remove the following duplicate tenants before re-running the migration'
      );
      each((result) => {
        // eslint-disable-next-line no-console
        console.log(result);
      }, resultsArray);
      throw new Error('Found duplicate tenants');
    }

    await tenantCollection.createIndex({ did: 1 }, { unique: true });
  },
  down: async () => {},
};
