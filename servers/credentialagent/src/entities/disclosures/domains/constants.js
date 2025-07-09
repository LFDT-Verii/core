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

const OfferMode = {
  WEBHOOK: 'webhook',
  PRELOADED: 'preloaded',
};

const IdentificationMethods = {
  VERIFIABLE_PRESENTATION: 'verifiable_presentation',
  PREAUTH: 'preauth',
};

const VendorEndpoint = {
  // webhook capabilities
  RECEIVE_CHECKED_CREDENTIALS: 'receive-checked-credentials',
  RECEIVE_UNCHECKED_CREDENTIALS: 'receive-unchecked-credentials',
  RECEIVE_APPLICANT: 'receive-applicant',
  ISSUING_IDENTIFICATION: 'issuing-identification',

  // integrated capabilities
  INTEGRATED_ISSUING_IDENTIFICATION: 'integrated-issuing-identification',
};

const ConfigurationType = {
  ISSUING: 'issuing',
  INSPECTION: 'inspection',
};

const VendorEndpointCategory = {
  ISSUING: [
    VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
    VendorEndpoint.ISSUING_IDENTIFICATION,
  ],
  INSPECTION: [
    VendorEndpoint.RECEIVE_APPLICANT,
    VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
    VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
  ],
};

module.exports = {
  IdentificationMethods,
  OfferMode,
  VendorEndpoint,
  VendorEndpointCategory,
  ConfigurationType,
};
