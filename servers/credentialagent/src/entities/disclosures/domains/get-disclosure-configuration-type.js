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

const newError = require('http-errors');
const { isEmpty, includes, upperCase } = require('lodash/fp');
const { VendorEndpointCategory, ConfigurationType } = require('./constants');

const getDisclosureConfigurationType = (
  disclosure,
  { config: { disclosureCredentialTypeRequired } }
) => {
  const { configurationType, vendorEndpoint } = disclosure;
  const isEmptyConfigurationType = isEmpty(configurationType);

  if (isEmptyConfigurationType && disclosureCredentialTypeRequired) {
    throw newError(400, 'Disclosure configuration type required', {
      errorCode: 'disclosure_configuration_type_required',
    });
  }

  const isExist = includes(
    vendorEndpoint,
    VendorEndpointCategory[upperCase(configurationType)]
  );

  if (!isEmptyConfigurationType && !isExist) {
    throw newError(400, 'Disclosure configuration type invalid', {
      errorCode: 'disclosure_invalid',
    });
  }

  const defaultConfigurationType =
    getConfigurationTypeByVendorEndpoint(vendorEndpoint);

  return isEmptyConfigurationType
    ? defaultConfigurationType
    : configurationType;
};

const getConfigurationTypeByVendorEndpoint = (vendorEndpoint) =>
  includes(vendorEndpoint, VendorEndpointCategory.INSPECTION)
    ? ConfigurationType.INSPECTION
    : ConfigurationType.ISSUING;

module.exports = {
  getDisclosureConfigurationType,
};
