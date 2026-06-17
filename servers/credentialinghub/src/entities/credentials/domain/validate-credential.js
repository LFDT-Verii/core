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
const { wrapValidationError } = require('@verii/validation');
const newError = require('http-errors');
const { keyBy, map, forEach } = require('lodash/fp');
const { CredentialErrors } = require('./credential-errors');

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

  return ({ credential, depotId, metadataIdx }) => {
    validateCredential(
      credential,
      depotsById[depotId],
      credentialTypeMetadatas[metadataIdx],
      credentialSubjectValidators[metadataIdx],
    );
  };
};
const validateCredential = (
  credential,
  depot,
  credentialTypeMetadata,
  validateCredentialSubject,
) => {
  if (depot == null) {
    throw newError(400, CredentialErrors.REFERENCED_DEPOT_NOT_FOUND, {
      errorCode: CredentialErrors.REFERENCED_DEPOT_NOT_FOUND,
    });
  }
  if (credentialTypeMetadata == null) {
    throw newError(400, CredentialErrors.CREDENTIAL_TYPE_NOT_FOUND, {
      errorCode: CredentialErrors.CREDENTIAL_TYPE_NOT_FOUND,
    });
  }

  validateCredentialSubject(credential.content.credentialSubject);
  if (validateCredentialSubject.errors !== null) {
    throw wrapValidationError(
      validateCredentialSubject.errors,
      'credential.content.credentialSubject',
    );
  }
};

module.exports = { initValidateCredential };
