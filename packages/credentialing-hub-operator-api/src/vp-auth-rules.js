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
const {
  castArray,
  filter,
  flatMap,
  flow,
  isArray,
  isBoolean,
  isEmpty,
  isNumber,
  isString,
  map,
  overSome,
  reduce,
  uniq,
} = require('lodash/fp');
const { toAuthMatchValue } = require('./auth-match-values');

const isScalar = overSome([isString, isNumber, isBoolean]);

const isObject = (value) =>
  value != null && typeof value === 'object' && !isArray(value);

const isArrayIndex = (component) =>
  Number.isInteger(component) && component >= 0;

const selectKey = (key, value) =>
  isObject(value) && Object.hasOwn(value, key) ? [value[key]] : [];

const selectIndex = (index, value) =>
  isArray(value) && index < value.length ? [value[index]] : [];

const selectEvery = (value) => (isArray(value) ? value : []);

// One claims path pointer segment applied to one selected element. A segment
// that doesn't apply to the element, or a missing key or index, drops it.
const selectSegment = (component, value) => {
  if (isString(component)) {
    return selectKey(component, value);
  }
  if (component === null) {
    return selectEvery(value);
  }
  return isArrayIndex(component) ? selectIndex(component, value) : [];
};

// Evaluates a claims path pointer (OpenID4VP 1.0, section 7) against a
// credential and returns what it selects. A string selects a key of each
// selected object, a non-negative integer an index of each selected array, and
// null every element of each selected array. It never throws.
const selectClaims = (pointer, credential) =>
  isArray(pointer) && !isEmpty(pointer)
    ? reduce(
        (selected, component) =>
          flatMap((value) => selectSegment(component, value), selected),
        [credential],
        pointer,
      )
    : [];

// A rule's pointers are tried in order, and the first one that selects a
// usable value supplies the values. A selection of only nulls, objects or
// arrays falls through to the next pointer.
const firstUsableValues = (pointers, credential) => {
  for (const pointer of castArray(pointers)) {
    const usable = filter(isScalar, selectClaims(pointer, credential));
    if (!isEmpty(usable)) {
      return usable;
    }
  }
  return [];
};

// The distinct normalized scalar values that a rule finds in the credentials of
// its type. credentials are { type, credential } for each verified credential.
const ruleValues = (rule, credentials) =>
  flow(
    filter(({ type }) => type === rule.type),
    map('credential'),
    flatMap((credential) => firstUsableValues(rule.path, credential)),
    map(toAuthMatchValue),
    uniq,
  )(credentials);

module.exports = { ruleValues, selectClaims };
