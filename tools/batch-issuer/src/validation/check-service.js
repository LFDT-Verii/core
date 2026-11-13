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

const {
  flow,
  includes,
  isEmpty,
  isEqual,
  map,
  range,
  reject,
  size,
  sortBy,
  zipWith,
} = require('lodash/fp');
const {
  isInternalVpAuth,
  isServiceDeactivated,
} = require('@verii/credentialing-hub-operator-api');

const isPreauth = (service) => includes('preauth', service.authMethods);

// The rules in valueIndex order. Only an internal verifiable_presentation
// service matches depots by their auth values.
const authRulesOf = (service) =>
  isInternalVpAuth(service)
    ? sortBy('valueIndex', service.verifiablePresentationAuthRules)
    : [];

const checkAuthMethods = (service) => {
  if (!isInternalVpAuth(service) && !isPreauth(service)) {
    return [
      {
        reason:
          'the service must use internal verifiable_presentation auth or preauth',
      },
    ];
  }
  return isInternalVpAuth(service) && isEmpty(authRulesOf(service))
    ? [{ reason: 'the service has no verifiablePresentationAuthRules' }]
    : [];
};

const checkActive = (service) =>
  isServiceDeactivated(service)
    ? [{ reason: `the service was deactivated at ${service.deactivationDate}` }]
    : [];

const toAuthColumn = ({ column }, rule) => ({ column, rule });

// depot.authValues gives the column of each rule, in valueIndex order, so it
// needs exactly one entry per rule, and the rules' value indexes must be 0 to
// n-1.
const mapAuthColumns = (spec, service) => {
  const rules = authRulesOf(service);
  const specAuthValues = spec.depot.authValues ?? [];
  if (size(specAuthValues) !== size(rules)) {
    const reason = `depot.authValues has ${size(specAuthValues)} entries, but the service has ${size(rules)} auth rules`;
    return { errors: [{ reason }] };
  }
  if (!isEqual(range(0, size(rules)), map('valueIndex', rules))) {
    const reason = `the service's auth rules must have the valueIndexes 0 to ${size(rules) - 1}`;
    return { errors: [{ reason }] };
  }
  return {
    authColumns: zipWith(toAuthColumn, specAuthValues, rules),
    errors: [],
  };
};

const checkTemplateTypes = (spec, templates) => {
  const expectedTypes = spec.depot.expectedCredentialTypes;
  if (isEmpty(expectedTypes)) {
    return [];
  }
  const toError = ({ template, type }) => ({
    reason: `template ${template} has the type ${type}, which is not in depot.expectedCredentialTypes`,
  });
  return flow(
    reject(({ type }) => includes(type, expectedTypes)),
    map(toError),
  )(templates);
};

/**
 * Step 1: checks the spec against the issuer service.
 * @param {{ spec: object, templates: Array<object>, service?: object }} context
 * @returns {{ authColumns?: Array<{ column: string, rule: object }>, errors: Array<{ reason: string }> }}
 *   the column of each auth rule in valueIndex order, missing when the spec and
 *   the service don't fit, and the errors
 */
const checkService = ({ spec, templates, service }) => {
  const typeErrors = checkTemplateTypes(spec, templates);
  if (service == null) {
    const reason = `tenant ${spec.tenantId} has no issuer service ${spec.serviceId}`;
    return { errors: [{ reason }, ...typeErrors] };
  }
  const authMethodErrors = checkAuthMethods(service);
  const activeErrors = checkActive(service);
  if (!isEmpty(authMethodErrors)) {
    return { errors: [...authMethodErrors, ...activeErrors, ...typeErrors] };
  }
  const { authColumns, errors: authErrors } = mapAuthColumns(spec, service);
  return {
    authColumns,
    errors: [...activeErrors, ...authErrors, ...typeErrors],
  };
};

module.exports = { checkService, isPreauth };
