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

const { VendorEndpoint } = require('../../disclosures');

const ExchangeErrors = {
  DISCLOSURE_ID_REQUIRED: 'The "disclosureId" property is required',
  IDENTIFICATION_DISCLOSURE_MISSING_TEMPLATE: (tenant) =>
    `Cannot create "exchange". The tenant ${
      tenant.did
    } is missing a disclosure with ${JSON.stringify({
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
    })}`,
  IDENTITY_MATCHER_VALUES_REQUIRED:
    'When disclosure is using the { "vendorEndpoint: "integrated-issuing-identification" } "identityMatcherValues" property is required',
  IDENTITY_MATCHER_VALUE_REQUIRED: (index) =>
    `"identityMatcherValues[${index}]" must contain a value`,
};

module.exports = { ExchangeErrors };
