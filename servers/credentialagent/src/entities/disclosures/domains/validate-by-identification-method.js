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

const { isEmpty, includes, some } = require('lodash/fp');
const newError = require('http-errors');
const { DisclosureErrors } = require('./errors');
const { IdentificationMethods } = require('./constants');

const validateByIdentificationMethod = (disclosure, setIssuingDefault) => {
  validateByVerifiablePresentationMethod(disclosure);
  validateByPreauthMethod(disclosure, setIssuingDefault);
};

const validateByVerifiablePresentationMethod = (disclosure) => {
  if (
    !includes(
      IdentificationMethods.VERIFIABLE_PRESENTATION,
      disclosure.identificationMethods
    )
  ) {
    return;
  }
  if (some(isEmpty, disclosure.types)) {
    throw newError(400, DisclosureErrors.TYPES_REQUIRED, {
      errorCode: 'request_validation_failed',
    });
  }
};

const identificationMethodsIncludesPreauth = (identificationMethods) => {
  return includes(IdentificationMethods.PREAUTH, identificationMethods);
};
const validateByPreauthMethod = (disclosure, setIssuingDefault) => {
  if (!identificationMethodsIncludesPreauth(disclosure.identificationMethods)) {
    return;
  }
  if (disclosure.types) {
    throw newError(400, DisclosureErrors.PREAUTH_TYPES_MAY_NOT_BE_SPECIFIED, {
      errorCode: 'request_validation_failed',
    });
  }
  if (setIssuingDefault) {
    throw newError(
      400,
      DisclosureErrors.PREAUTH_TYPES_MAY_NOT_BE_SET_ISSUING_DEFAULT,
      {
        errorCode: 'request_validation_failed',
      }
    );
  }
};

module.exports = {
  validateByIdentificationMethod,
  identificationMethodsIncludesPreauth,
};
