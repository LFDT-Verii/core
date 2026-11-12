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

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const {
  flow,
  get,
  has,
  isEmpty,
  isString,
  map,
  matches,
  overSome,
  pick,
  reject,
  startsWith,
  trim,
} = require('lodash/fp');
const { convertValue } = require('./convert-value');
const { MISSING } = require('../validation/reasons');

const isPhoneRule = overSome([
  matches({ type: 'PhoneV1.0' }),
  matches({ valueFormat: 'e164' }),
]);

const isEmailRule = overSome([
  matches({ type: 'EmailV1.0' }),
  matches({ valueFormat: 'email' }),
]);

// The Hub checks an `email` valueFormat with AJV's email format, so this does too.
const emailAjv = new Ajv();
addFormats(emailAjv, ['email']);
const isEmailAddress = emailAjv.compile({ type: 'string', format: 'email' });

// Phone credentials hold E.164 numbers, such as +15556192191. A number written
// without a country code takes the default country. Only the number's length
// is checked, so test ranges such as 555 numbers are accepted.
const normalizePhone = (text, defaultCountry) => {
  const phoneNumber = parsePhoneNumberFromString(text, { defaultCountry });
  if (phoneNumber?.isPossible()) {
    return { value: phoneNumber.number };
  }
  const hint =
    defaultCountry == null && !startsWith('+', text)
      ? '. It has no country code, so pass --default-country'
      : '';
  return { reason: `"${text}" is not a phone number${hint}` };
};

const checkEmail = (text) =>
  isEmailAddress(text)
    ? { value: text }
    : { reason: `"${text}" is not an email address` };

const formatAuthValue = (rule, text, { defaultCountry }) => {
  if (isPhoneRule(rule)) {
    return normalizePhone(text, defaultCountry);
  }
  if (isEmailRule(rule)) {
    return checkEmail(text);
  }
  return { value: text };
};

/**
 * Converts a CSV cell to the value a depot's `authValues` holds for a rule.
 * The cell is trimmed and converted to the rule's `valueType`. A phone rule's
 * value is normalized to E.164, and an email rule's value must be an email
 * address.
 * @param {object} rule the auth rule
 * @param {string} [text] the cell, missing when the row has no such cell
 * @param {{ defaultCountry?: string }} options
 * @returns {{ value: string|number|boolean } | { reason: string }}
 */
const toAuthValue = (rule, text, options) => {
  if (text == null) {
    return { reason: MISSING };
  }
  const trimmed = trim(text);
  if (isEmpty(trimmed)) {
    return { reason: 'is blank' };
  }
  const converted = convertValue(rule.valueType, trimmed);
  if (has('reason', converted) || !isString(converted.value)) {
    return converted;
  }
  return formatAuthValue(rule, converted.value, options);
};

// Only the row's own values count, so a column named like an inherited
// property, such as "constructor", is missing when the row doesn't have it.
const cellOf = (column, data) =>
  has([column], data) ? get([column], data) : undefined;

/**
 * Builds a row's auth values, one for each rule, in `valueIndex` order.
 * @param {Array<{ column: string, rule: object }>} authColumns each auth rule and the column that holds its value
 * @param {object} data the row's values by column
 * @param {{ defaultCountry?: string }} options
 * @returns {{ authValues?: Array<string|number|boolean>, errors: Array<{ column: string, reason: string }> }}
 *   the auth values, which are missing when any of them is invalid, and the errors
 */
const buildAuthValues = (authColumns, data, options) => {
  const toColumnResult = ({ column, rule }) => ({
    column,
    ...toAuthValue(rule, cellOf(column, data), options),
  });
  const results = map(toColumnResult, authColumns);
  const errors = flow(
    reject(has('value')),
    map(pick(['column', 'reason'])),
  )(results);
  return isEmpty(errors)
    ? { authValues: map('value', results), errors }
    : { errors };
};

module.exports = { buildAuthValues };
