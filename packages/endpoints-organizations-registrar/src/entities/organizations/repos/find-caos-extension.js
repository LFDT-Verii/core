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
const { isEmpty, flow, map, uniq } = require('lodash/fp');
const { stripFragmentFromDidUrl } = require('@verii/did-doc');

const findCaosExtension = (parent) => ({
  findCaos: (caoServiceIds, projection) => {
    if (isEmpty(caoServiceIds)) {
      return [];
    }
    const caoDids = flow(map(stripFragmentFromDidUrl), uniq)(caoServiceIds);
    return parent.find({
      filter: {
        $or: [
          {
            'didDoc.id': {
              $in: caoDids,
            },
          },
          {
            'didDoc.alsoKnownAs': {
              $elemMatch: {
                $in: caoDids,
              },
            },
          },
        ],
        '@ignoreScope': true,
      },
      projection,
    });
  },
});

module.exports = { findCaosExtension };
