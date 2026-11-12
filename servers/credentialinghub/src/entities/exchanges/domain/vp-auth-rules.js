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
  flatMap,
  flow,
  get,
  has,
  identity,
  isEmpty,
  map,
  reduce,
  size,
  some,
  sortBy,
} = require('lodash/fp');
const { ruleValues } = require('@verii/credentialing-hub-operator-api');

const MAX_CANDIDATE_TUPLES = 100;

// pick keeps every value found. equal needs exactly one distinct value.
const RuleCandidateValues = {
  pick: identity,
  equal: (values) => (size(values) === 1 ? values : []),
};

// Only the rules' own names count, so a stored rule such as "constructor" gives
// no values rather than an inherited method.
const ruleCandidateValues = (rule, credentials) => {
  if (!has([rule.rule], RuleCandidateValues)) {
    return [];
  }
  const candidateValues = get([rule.rule], RuleCandidateValues);
  return flow(ruleValues, candidateValues)(rule, credentials);
};

// Multiplies the count by a position's number of values, holding the product
// just past the limit, so it never overflows to Infinity, and Infinity * 0
// never gives NaN.
const multiplyCount = (count, values) =>
  Math.min(count * size(values), MAX_CANDIDATE_TUPLES + 1);

const isOverCandidateLimit = (count) => count > MAX_CANDIDATE_TUPLES;

// Multiplies the positions' value counts and compares them with the limit.
const exceedsCandidateLimit = flow(
  reduce(multiplyCount, 1),
  isOverCandidateLimit,
);

// Each tuple extended with each of the position's values.
const appendPosition = (tuples, values) => {
  const extendWithEachValue = (tuple) =>
    map((value) => [...tuple, value], values);
  return flatMap(extendWithEachValue, tuples);
};

// Every combination of the positions' values. A position without values leaves
// no tuples, and the count is checked before any tuple is built.
const combinePositions = (valuesByPosition) => {
  if (isEmpty(valuesByPosition) || some(isEmpty, valuesByPosition)) {
    return [];
  }
  if (exceedsCandidateLimit(valuesByPosition)) {
    throw newError(
      400,
      `The presented credentials give more than ${MAX_CANDIDATE_TUPLES} combinations of auth values`,
      { errorCode: 'presentation_invalid' },
    );
  }
  return reduce(appendPosition, [[]], valuesByPosition);
};

// The tuples that a depot's authMatchValues must equal exactly: every
// combination of the rules' values, each value at its rule's valueIndex. The
// value indexes are 0 to n-1, so ordering the rules by them gives the
// positions.
const buildCandidateTuples = (rules, credentials) => {
  const candidateValuesOf = (rule) => ruleCandidateValues(rule, credentials);
  return flow(
    sortBy('valueIndex'),
    map(candidateValuesOf),
    combinePositions,
  )(rules);
};

module.exports = { buildCandidateTuples };
