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
  pick: (values) => values,
  equal: (values) => (size(values) === 1 ? values : []),
};

const ruleCandidateValues = (rule, credentials) =>
  Object.hasOwn(RuleCandidateValues, rule.rule)
    ? RuleCandidateValues[rule.rule](ruleValues(rule, credentials))
    : [];

// Multiplies the positions' value counts, holding the product just past the
// limit, so it never overflows to Infinity, and Infinity * 0 never gives NaN.
const exceedsCandidateLimit = (valuesByPosition) =>
  reduce(
    (count, values) => Math.min(count * size(values), MAX_CANDIDATE_TUPLES + 1),
    1,
    valuesByPosition,
  ) > MAX_CANDIDATE_TUPLES;

const appendPosition = (tuples, values) =>
  flatMap((tuple) => map((value) => [...tuple, value], values), tuples);

// The tuples that a depot's authMatchValues must equal exactly: every
// combination of the rules' values, each value at its rule's valueIndex. The
// value indexes are 0 to n-1, so ordering the rules by them gives the
// positions. A position without values leaves no tuples, and the count is
// checked before any tuple is built.
const buildCandidateTuples = (rules, credentials) => {
  const valuesByPosition = flow(
    sortBy('valueIndex'),
    map((rule) => ruleCandidateValues(rule, credentials)),
  )(rules);
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

module.exports = { buildCandidateTuples };
