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
const { calcSha384 } = require('@verii/crypto');
const { flow, identity, map, sortBy } = require('lodash/fp');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');

// valueType changes what a rule reads, so it's part of the hash. valueFormat
// doesn't change matching, so it isn't.
const canonicalRules = flow(
  map(({ path, rule, valueIndex, type, valueType }) => ({
    path,
    rule,
    valueIndex,
    type,
    valueType,
  })),
  sortBy('valueIndex'),
);

const canonicalTypes = flow(map('type'), sortBy(identity));

// A hash of the auth configuration that a depot's authMatchValues were built
// for: the rules and the requested credential types. A depot only matches, and
// only counts for the 409, under the configuration it was created with.
const buildAuthRulesFingerprint = (service) =>
  isInternalVpAuth(service)
    ? calcSha384(
        JSON.stringify({
          rules: canonicalRules(service.verifiablePresentationAuthRules),
          types: canonicalTypes(service.disclosureRequest?.types),
        }),
      )
    : null;

module.exports = { buildAuthRulesFingerprint };
