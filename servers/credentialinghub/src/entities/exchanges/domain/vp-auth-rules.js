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
const newError = require('http-errors');
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
  size,
  sortBy,
  uniq,
} = require('lodash/fp');
const { toAuthMatchValue } = require('../../depots/domain/auth-match-values');

const MAX_CANDIDATE_TUPLES = 100;

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

// pick keeps every value found. equal needs exactly one distinct value.
const RuleCandidateValues = {
  pick: (values) => values,
  equal: (values) => (size(values) === 1 ? values : []),
};

const ruleCandidateValues = (rule, credentials) =>
  Object.hasOwn(RuleCandidateValues, rule.rule)
    ? RuleCandidateValues[rule.rule](ruleValues(rule, credentials))
    : [];

const countCandidateTuples = (valuesByPosition) =>
  isEmpty(valuesByPosition)
    ? 0
    : reduce((count, values) => count * size(values), 1, valuesByPosition);

const appendPosition = (tuples, values) =>
  flatMap((tuple) => map((value) => [...tuple, value], values), tuples);

// The tuples that a depot's authMatchValues must equal exactly: every
// combination of the rules' values, each value at its rule's valueIndex. The
// value indexes are 0 to n-1, so ordering the rules by them gives the
// positions. The count is checked before the tuples are built.
const buildCandidateTuples = (rules, credentials) => {
  const valuesByPosition = flow(
    sortBy('valueIndex'),
    map((rule) => ruleCandidateValues(rule, credentials)),
  )(rules);
  const count = countCandidateTuples(valuesByPosition);
  if (count > MAX_CANDIDATE_TUPLES) {
    throw newError(
      400,
      `The presented credentials give more than ${MAX_CANDIDATE_TUPLES} combinations of auth values`,
      { errorCode: 'presentation_invalid' },
    );
  }
  return count === 0 ? [] : reduce(appendPosition, [[]], valuesByPosition);
};

module.exports = { buildCandidateTuples, ruleValues, selectClaims };
