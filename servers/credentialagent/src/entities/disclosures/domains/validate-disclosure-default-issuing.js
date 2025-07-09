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
const {
  ConfigurationType,
  VendorEndpointCategory,
  IdentificationMethods,
} = require('./constants');

// eslint-disable-next-line complexity
const validateDisclosureDefaultIssuing = (
  disclosure,
  tenant,
  setIssuingDefault
) => {
  const { defaultIssuingDisclosureId } = tenant;
  const { identificationMethods } = disclosure;
  const isIssuingDisclosure = checkIsIssuingDisclosure(disclosure);

  if (!isIssuingDisclosure && setIssuingDefault) {
    throw newError(
      400,
      'The default disclosure cannot be of type "inspection"',
      {
        errorCode: 'issuing_default_not_compatible',
      }
    );
  }

  if (
    some(
      (identificationMethod) =>
        identificationMethod === IdentificationMethods.PREAUTH,
      identificationMethods
    )
  ) {
    return;
  }

  if (
    isIssuingDisclosure &&
    !defaultIssuingDisclosureId &&
    !setIssuingDefault
  ) {
    throw newError(
      400,
      'The first "issuing" configuration created must be set as the default.',
      {
        errorCode: 'first_issuing_configuration_must_be_default',
      }
    );
  }
};

const checkIsIssuingDisclosure = (disclosure) => {
  if (isEmpty(disclosure?.configurationType)) {
    return includes(disclosure?.vendorEndpoint, VendorEndpointCategory.ISSUING);
  }

  return disclosure.configurationType === ConfigurationType.ISSUING;
};

module.exports = { validateDisclosureDefaultIssuing };
