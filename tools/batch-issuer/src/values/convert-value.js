/**
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
 */

const { flow, get, has, isFinite, toLower, trim } = require('lodash/fp');

const ValueTypes = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
};

// Decimal notation only, so "0x10", "Infinity" and "" aren't numbers.
const DECIMAL_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

const BOOLEANS = { true: true, false: false };

const toString = (text) => ({ value: text });

const toNumber = (text) => {
  const trimmed = trim(text);
  const value = Number(trimmed);
  return DECIMAL_NUMBER.test(trimmed) && isFinite(value)
    ? { value }
    : { reason: `"${text}" is not a number` };
};

const booleanKey = flow(trim, toLower);

const toBoolean = (text) => {
  const key = booleanKey(text);
  return has([key], BOOLEANS)
    ? { value: get([key], BOOLEANS) }
    : { reason: `"${text}" is not true or false` };
};

const converters = {
  [ValueTypes.STRING]: toString,
  [ValueTypes.NUMBER]: toNumber,
  [ValueTypes.BOOLEAN]: toBoolean,
};

/**
 * Converts a CSV cell to a value type.
 * @param {string} valueType `string`, `number` or `boolean`
 * @param {string} text the cell
 * @returns {{ value: string|number|boolean } | { reason: string }} the value, or why the cell doesn't convert
 */
const convertValue = (valueType, text) => {
  if (!has([valueType], converters)) {
    return { reason: `"${valueType}" is not a value type` };
  }
  const convert = get([valueType], converters);
  return convert(text);
};

module.exports = { convertValue, ValueTypes };
