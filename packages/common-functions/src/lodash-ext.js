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
  map,
  mapValues,
  findIndex,
  set,
  reduce,
  mapKeys,
  camelCase,
} = require('lodash/fp');

const mapWithIndex = map.convert({ cap: false });
const reduceWithIndex = reduce.convert({ cap: false });
const mapValuesByKey = mapValues.convert({ cap: false });
const findIndexWithIndex = findIndex.convert({ cap: false });
const prepCamelCase = (obj) => mapKeys((key) => camelCase(key), obj);

const replaceItem = (predicate, newItem, collection) => {
  const idx = findIndex(predicate, collection);
  if (idx === -1) {
    return collection ?? [];
  }
  const val = set(`[${idx}]`, newItem, collection);
  return val;
};

module.exports = {
  mapWithIndex,
  mapValuesByKey,
  reduceWithIndex,
  findIndexWithIndex,
  replaceItem,
  prepCamelCase,
};
