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
const { castArray, flow, isEqual, isNil, map, sortBy } = require('lodash/fp');

const canonicalRules = flow(
  map(({ path, rule, valueIndex }) => ({
    path: castArray(path),
    rule,
    valueIndex,
  })),
  sortBy('valueIndex'),
);

// Reordering the same rules in the array isn't a change. Adding or removing
// rules, or the field itself, is.
const vpAuthRulesChanged = (existingService, service) => {
  const existingRules = existingService.verifiablePresentationAuthRules;
  const rules = service.verifiablePresentationAuthRules;
  return (
    isNil(existingRules) !== isNil(rules) ||
    !isEqual(canonicalRules(existingRules), canonicalRules(rules))
  );
};

module.exports = { vpAuthRulesChanged };
