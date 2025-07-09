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

const { reduce, isDate, keys } = require('lodash/fp');
const { ObjectId } = require('mongodb');

const jsonify = (obj, convertId = true) =>
  reduce(
    (acc, k) => {
      if (isDate(obj[k])) {
        acc[k] = obj[k].toISOString();
      } else if (convertId && k === '_id') {
        acc.id = obj[k].toString();
      } else if (obj[k] instanceof ObjectId) {
        acc[k] = obj[k].toString();
      } else {
        acc[k] = obj[k];
      }
      return acc;
    },
    {},
    keys(obj)
  );

module.exports = { jsonify };
