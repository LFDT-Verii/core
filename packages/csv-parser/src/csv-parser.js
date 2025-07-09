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
  parseAsync,
  transforms: { unwind },
} = require('json2csv');
const {
  reduce,
  keys,
  isArray,
  isObject,
  isString,
  isEmpty,
  isDate,
  every,
  join,
  first,
  size,
  orderBy,
  map,
  zipObject,
  uniq,
  flatten,
} = require('lodash/fp');

const buildField = (nextKey, rootPathKeys) =>
  size(rootPathKeys)
    ? {
        label: join('_', [...rootPathKeys, nextKey]),
        value: join('.', [...rootPathKeys, nextKey]),
      }
    : nextKey;

const buildFields = (item, rootPathKeys = []) =>
  reduce(
    (arrFields, nextKey) => {
      if (isArray(item[nextKey]) && every(isString, item[nextKey])) {
        return [
          ...arrFields,
          {
            label: join('_', [...rootPathKeys, nextKey]),
            value: (row) => join(', ', row[nextKey]),
          },
        ];
      }
      if (isArray(item[nextKey])) {
        const subFields = buildFields(mergeKeys(item[nextKey]), [
          ...rootPathKeys,
          nextKey,
        ]);
        return [...arrFields, ...subFields];
      }
      if (isObject(item[nextKey]) && !isDate(item[nextKey])) {
        const subFields = buildFields(item[nextKey], [
          ...rootPathKeys,
          nextKey,
        ]);
        return [...arrFields, ...subFields];
      }
      const newField = buildField(nextKey, rootPathKeys);
      return [...arrFields, newField];
    },
    [],
    keys(item)
  );

const mapLabelsAndValues = (data) => {
  const item = first(data);
  const fields = buildFields(item);
  return orderBy((i) => (isString(i) ? i : i.label), ['asc'], fields);
};

const parseToCsv = async (data, transformsPath = []) => {
  if (!isArray(data) || isEmpty(data)) {
    throw new Error('Data must be array and not empty');
  }

  const transforms = [unwind({ paths: transformsPath, blankOut: true })];

  const options = {
    fields: mapLabelsAndValues(data),
    defaultValue: '-',
    eol: '\r\n',
    transforms,
  };

  const transformOptions = { highWaterMark: 8192 };

  return parseAsync(data, options, transformOptions);
};

const mergeKeys = (array) => {
  const resultKeys = uniq(flatten(map(keys, array)));
  const resultObject = zipObject(resultKeys, Array(resultKeys.length).fill(''));
  return resultObject;
};

module.exports = { parseToCsv };
