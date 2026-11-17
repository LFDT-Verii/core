/*
 * Copyright 2024 Velocity Team
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
  filter,
  first,
  flatten,
  flow,
  forEach,
  includes,
  isEmpty,
  join,
  keyBy,
  map,
} = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const { extractCredentialType } = require('@verii/vc-checks');
const { CredentialErrors } = require('@verii/credentialing-hub-operator-api');

const CREDENTIAL_TYPE_PATH = '/credential/content/type';
const CREDENTIAL_SUBJECT_PATH = '/credential/content/credentialSubject';

// Validates every item and throws one 400 that lists the problems of all of
// them, so nothing is created when any item is invalid.
const initValidateCredentials = (
  depots,
  credentialTypeMetadatas,
  schemas,
  context,
) => {
  const validateCredential = initValidateCredential(
    depots,
    credentialTypeMetadatas,
    schemas,
    context,
  );

  const validateItem = (item, index) =>
    flow(validateCredential, map(toItemError(index)))(item);

  return (credentialItems) => {
    const errors = flow(mapWithIndex(validateItem), flatten)(credentialItems);
    if (!isEmpty(errors)) {
      throw newCredentialItemsError(errors);
    }
  };
};

// Returns the item's problems as { path, errorCode, message }, with the path
// relative to the item.
const initValidateCredential = (
  depots,
  credentialTypeMetadatas,
  schemas,
  context,
) => {
  const depotsById = keyBy('_id', depots);

  forEach((schema) => {
    context.addDocSchema(schema, true);
  }, schemas);

  const credentialSubjectValidators = map(
    (schema) => context.getDocValidator(schema.$id),
    schemas,
  );

  return ({ credential, depotId, metadataIdx }) => [
    ...validateDepot(credential, depotsById[depotId]),
    ...validateCredentialType(
      credential,
      credentialTypeMetadatas[metadataIdx],
      credentialSubjectValidators[metadataIdx],
    ),
  ];
};

const validateDepot = (credential, depot) => {
  if (depot == null) {
    return [problem('/depotId', CredentialErrors.REFERENCED_DEPOT_NOT_FOUND)];
  }
  if (isUnexpectedCredentialType(credential, depot)) {
    return [
      problem(
        CREDENTIAL_TYPE_PATH,
        CredentialErrors.CREDENTIAL_TYPE_NOT_EXPECTED,
      ),
    ];
  }
  return [];
};

const validateCredentialType = (
  credential,
  credentialTypeMetadata,
  validateCredentialSubject,
) => {
  if (credentialTypeMetadata == null) {
    return [
      problem(CREDENTIAL_TYPE_PATH, CredentialErrors.CREDENTIAL_TYPE_NOT_FOUND),
    ];
  }
  const isSubjectValid = validateCredentialSubject(
    credential.content.credentialSubject,
  );
  return isSubjectValid
    ? []
    : map(toSchemaProblem, validateCredentialSubject.errors);
};

const isUnexpectedCredentialType = (credential, { expectedCredentialTypes }) =>
  !isEmpty(expectedCredentialTypes) &&
  !includes(extractCredentialType(credential.content), expectedCredentialTypes);

const problem = (path, errorCode) => ({ path, errorCode, message: errorCode });

// One problem per AJV error, with the message wrapValidationError gives it
const toSchemaProblem = ({ instancePath, message }) => ({
  path: `${CREDENTIAL_SUBJECT_PATH}${instancePath}`,
  errorCode: CredentialErrors.REQUEST_VALIDATION_FAILED,
  message: `credential.content.credentialSubject${instancePath} ${message}`,
});

const toItemError =
  (index) =>
  ({ path, errorCode, message }) => ({
    index,
    path: `/items/${index}${path}`,
    errorCode,
    message,
  });

// The top-level errorCode and message are the ones returned before every item
// was reported: the first invalid item's first problem, with all the schema
// errors of a credentialSubject in one message.
const newCredentialItemsError = (errors) => {
  const { index, errorCode } = first(errors);
  const message = flow(
    filter({ index, errorCode }),
    map('message'),
    join(', '),
  )(errors);
  return newError(400, message, { errorCode, errors });
};

module.exports = { initValidateCredentials };
