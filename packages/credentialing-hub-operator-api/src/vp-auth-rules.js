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
  isBoolean,
  isEmpty,
  isInteger,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  map,
  negate,
  overSome,
  stubTrue,
  uniq,
} = require('lodash/fp');
const { toAuthMatchValue } = require('./auth-match-values');

const isScalar = overSome([isString, isNumber, isBoolean]);

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
// The pointer runs as a flow of its segments' selectors. It never throws.
const selectClaims = (pointer, credential) =>
  isArray(pointer) && !isEmpty(pointer)
    ? flow(map(segmentSelector, pointer))([credential])
    : [];

// A rule's pointers are tried in order, and the first one that selects a
// usable value supplies the values. A selection of only nulls, objects or
// arrays falls through to the next pointer. A rule has at most 10 pointers, so
// every pointer is evaluated.
const firstUsableValues = (pointers, credential) =>
  flow(
    castArray,
    map((pointer) => filter(isScalar, selectClaims(pointer, credential))),
    find(negate(isEmpty)),
    defaultTo([]),
  )(pointers);

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
