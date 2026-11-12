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
  cond,
  constant,
  defaultTo,
  filter,
  find,
  flatMap,
  flatten,
  flow,
  get,
  has,
  isArray,
  isEmpty,
  isInteger,
  isNull,
  isPlainObject,
  isString,
  map,
  size,
  stubTrue,
  uniq,
} = require('lodash/fp');
const { toAuthMatchValue } = require('./auth-match-values');
const { isOfValueType } = require('./auth-value-types');

const isArrayIndex = (component) => isInteger(component) && component >= 0;

// Each claims path pointer segment is a selector: it takes the selected
// elements and returns what it selects from them. A segment applies only to
// the elements it fits and drops the others, so a key never reads an array's or
// a string's length, and an index never reads a character of a string.

// A key selects that own property, never an inherited one, of each object. The
// path is an array, so a key such as "a.b" or "a[0]" is read as it is, not
// parsed as a path.
const selectKey = (key) =>
  flow(filter(isPlainObject), filter(has([key])), map(get([key])));

// An index selects that element of each array.
const selectIndex = (index) =>
  flow(filter(isArray), filter(has([index])), map(get([index])));

// null selects every element of each array.
const selectEvery = flow(filter(isArray), flatten);

const selectNothing = constant([]);

const segmentSelector = cond([
  [isString, selectKey],
  [isNull, constant(selectEvery)],
  [isArrayIndex, selectIndex],
  [stubTrue, constant(selectNothing)],
]);

// Evaluates a claims path pointer (OpenID4VP 1.0, section 7) against a
// credential and returns what it selects. A string selects a key of each
// selected object, a non-negative integer an index of each selected array, and
// null every element of each selected array. Any other segment selects nothing.
// It never throws.
//
// An empty pointer selects nothing, rather than the credential. Otherwise each
// segment is a step that works on the list of values selected so far, starting
// from the credential.
const selectClaims = (pointer, credential) => {
  if (!isArray(pointer) || isEmpty(pointer)) {
    return [];
  }
  const steps = map(segmentSelector, pointer);
  return flow(steps)([credential]);
};

// A rule's pointers are tried in order, and the first one that selects a
// usable value supplies the values. A selection of only nulls, objects, arrays
// or values of another type than the rule's falls through to the next pointer.
// A rule has at most 10 pointers, so every pointer is evaluated. A path that
// isn't an array reads nothing: map would walk an object's values as if they
// were pointers.
const firstUsableValues = (pointers, isUsable, credential) => {
  if (!isArray(pointers)) {
    return [];
  }
  const selectFromCredential = (pointer) => selectClaims(pointer, credential);
  const usableValues = flow(selectFromCredential, filter(isUsable));
  return flow(map(usableValues), find(size), defaultTo([]))(pointers);
};

// The distinct normalized values of the rule's valueType that a rule finds in
// the credentials of its type. Values of another type are ignored, never
// converted. credentials are { type, credential } for each verified
// credential.
const ruleValues = (rule, credentials) => {
  const isOfRuleType = ({ type }) => type === rule.type;
  const isUsable = isOfValueType(rule.valueType);
  const valuesInCredential = (credential) =>
    firstUsableValues(rule.path, isUsable, credential);
  return flow(
    filter(isOfRuleType),
    map('credential'),
    flatMap(valuesInCredential),
    map(toAuthMatchValue),
    uniq,
  )(credentials);
};

module.exports = { ruleValues, selectClaims };
