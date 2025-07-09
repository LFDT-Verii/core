/**
 * Copyright 2023 Velocity Team
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
  castArray,
  isEmpty,
  find,
  keys,
  isEqual,
  isObject,
  values,
} = require('lodash/fp');

// eslint-disable-next-line complexity
const verifyPrimarySourceIssuer = (
  { credential: { credentialSubject }, issuerId, jsonLdContext },
  { log }
) => {
  if (isEmpty(jsonLdContext)) {
    throw new Error('unresolved_credential_subject_context');
  }

  const subContext = getCredentialSubjectTypeFromContext(
    credentialSubject,
    jsonLdContext
  );
  if (isEmpty(subContext)) {
    log.warn('Credential subject "type" not found in @context');
    return true;
  }

  const primaryOrgProp = getPrimaryOrgPropFromContext(subContext);
  if (isEmpty(primaryOrgProp)) {
    log.warn('@context is missing primary organization type');
    return true;
  }

  const primaryOrgIdentifier = getIdentifier(primaryOrgProp, credentialSubject);

  if (
    !isEmpty(primaryOrgIdentifier) &&
    !isEqual(primaryOrgIdentifier, issuerId)
  ) {
    throw new Error('issuer_requires_notary_permission');
  }

  return true;
};

const getCredentialSubjectTypeFromContext = (
  credentialSubject,
  completeContext
) => {
  for (const type of castArray(credentialSubject?.type)) {
    if (completeContext['@context']?.[type] != null) {
      return completeContext['@context']?.[type];
    }
  }

  return undefined;
};

const getPrimaryOrgPropFromContext = (contextType) => {
  const primarySourceKey = getPrimarySourceProfile(contextType);
  const primaryOrganizationKey = getPrimaryOrganizationKey(contextType);
  return primarySourceKey || primaryOrganizationKey;
};

const getPrimarySourceProfile = (contextType) => {
  const contextKeys = keys(contextType['@context']);
  return find(
    (key) =>
      isEqual(
        contextType['@context']?.[key]?.['@id'],
        'https://velocitynetwork.foundation/contexts#primarySourceProfile'
      ),
    contextKeys
  );
};

const getPrimaryOrganizationKey = (contextType) => {
  const contextKeys = keys(contextType['@context']);
  return find(
    (key) =>
      isEqual(
        contextType['@context']?.[key]?.['@id'],
        'https://velocitynetwork.foundation/contexts#primaryOrganization'
      ),
    contextKeys
  );
};

const getIdentifier = (primaryOrgProp, jsonObject = {}) => {
  let identifier;
  const stack = [jsonObject];
  while (stack.length > 0) {
    const obj = stack.pop();

    identifier = getPrimaryIdentifier(obj[primaryOrgProp]);
    if (!isEmpty(identifier)) {
      break;
    }

    for (const val of values(obj)) {
      // eslint-disable-next-line max-depth
      if (isObject(val)) {
        stack.push(val);
      }
    }
  }

  return identifier;
};

const getPrimaryIdentifier = (value) => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (value?.identifier) {
    return value.identifier;
  }

  return value?.id;
};

module.exports = {
  verifyPrimarySourceIssuer,
};
