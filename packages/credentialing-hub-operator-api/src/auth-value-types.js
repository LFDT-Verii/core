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
const { fullFormats } = require('ajv-formats/dist/formats');
const {
  cond,
  constant,
  get,
  has,
  isBoolean,
  isFinite,
  isNil,
  isNumber,
  isString,
  overEvery,
  overSome,
  stubFalse,
  stubTrue,
} = require('lodash/fp');
const { toAuthMatchValue } = require('./auth-match-values');

// What a rule saved before valueType existed takes: any string, number or
// boolean.
const isScalar = overSome([isString, isNumber, isBoolean]);

// The checks of each valueType. They compare JavaScript types and never
// convert, and a number must be finite.
const ValueTypeChecks = {
  string: isString,
  number: isFinite,
  boolean: isBoolean,
};

// The check of AJV's email format, as the Hub's validator runs it (ajv-formats
// in full mode).
const isEmail = (value) => fullFormats.email.test(value);

const E164_PATTERN = /^\+[1-9][0-9]{1,14}$/;
const isE164 = (value) => E164_PATTERN.test(value);

const ValueFormatChecks = {
  email: overEvery([isString, isEmail]),
  e164: overEvery([isString, isE164]),
};

// Only the tables' own names count, so a stored "constructor" gets no check
// from Object.prototype.
const isKnownValueType = (valueType) => has([valueType], ValueTypeChecks);
const valueTypeCheck = (valueType) => get([valueType], ValueTypeChecks);
const isKnownValueFormat = (valueFormat) =>
  has([valueFormat], ValueFormatChecks);
const valueFormatCheck = (valueFormat) => get([valueFormat], ValueFormatChecks);

/**
 * The check that a value has a rule's `valueType`. Without a `valueType`, as in
 * rules saved before it existed, any string, number or boolean passes. An
 * unknown `valueType` passes nothing.
 * @param {string} [valueType] `string`, `number` or `boolean`
 * @returns {(value: unknown) => boolean} the check
 */
const isOfValueType = cond([
  [isNil, constant(isScalar)],
  [isKnownValueType, valueTypeCheck],
  [stubTrue, constant(stubFalse)],
]);

// The check that a value has a rule's valueFormat. Without one, every value
// passes, and an unknown one passes nothing.
const hasValueFormat = cond([
  [isNil, constant(stubTrue)],
  [isKnownValueFormat, valueFormatCheck],
  [stubTrue, constant(stubFalse)],
]);

const isNotBlank = (matchValue) => matchValue !== '';

/**
 * Whether a depot's auth value suits the rule at its `valueIndex`. The value is
 * checked as it is matched, after `toAuthMatchValue`: it has the rule's
 * `valueType`, it isn't a blank string, and it has the rule's `valueFormat`, if
 * the rule has one.
 * @param {{ valueType?: string, valueFormat?: string }} rule the auth rule
 * @param {unknown} value the auth value
 * @returns {boolean} whether the value suits the rule
 */
const isValidAuthValue = ({ valueType, valueFormat }, value) => {
  const suitsRule = overEvery([
    isOfValueType(valueType),
    isNotBlank,
    hasValueFormat(valueFormat),
  ]);
  return suitsRule(toAuthMatchValue(value));
};

module.exports = { isOfValueType, isValidAuthValue };
