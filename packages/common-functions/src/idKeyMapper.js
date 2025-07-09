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
  isArray,
  isPlainObject,
  map,
  forEach,
  keys,
  size,
  first,
} = require('lodash/fp');

const handleIdKey = (obj, k) => {
  if (k === '_id' && obj.id == null) {
    // eslint-disable-next-line better-mutation/no-mutation
    obj.id = obj._id;
  }
};
const idKeyMapper = (obj) => {
  forEach((k) => {
    handleIdKey(obj, k);
    if (isPlainObject(obj[k])) {
      // eslint-disable-next-line better-mutation/no-mutation
      obj[k] = idKeyMapper(obj[k]);
    }
    if (isArray(obj[k]) && size(obj[k]) > 0 && isPlainObject(first(obj[k]))) {
      // eslint-disable-next-line better-mutation/no-mutation
      obj[k] = map(idKeyMapper, obj[k]);
    }
  }, keys(obj));
  return obj;
};

module.exports = { idKeyMapper };
