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

const { ObjectId } = require('mongodb');
const { first, isPlainObject, map, mapValues } = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');

// eslint-disable-next-line complexity
const mongoify = mapValues((v) => {
  if (ISO_DATETIME_FORMAT.test(v)) {
    return new Date(v);
  }

  if (Array.isArray(v) && v.length > 0 && OBJECT_ID_FORMAT.test(first(v))) {
    return map((_v) => new ObjectId(_v), v);
  }

  if (OBJECT_ID_FORMAT.test(v)) {
    return new ObjectId(v);
  }

  if (Array.isArray(v) && v.length > 0 && isPlainObject(first(v))) {
    return map(mongoify, v);
  }

  if (isPlainObject(v)) {
    return mongoify(v);
  }
  return v;
});

module.exports = { mongoify };
