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

const DisclosureErrors = {
  DUPLICATE_ISSUING_IDENTIFICATION:
    'Only one disclosure for "issuing-identification" endpoint is allowed per tenant',
  IDENTITY_MATCHERS_REQUIRED:
    'When using { "vendorEndpoint": "integrated-issuing-identification" } "identityMatchers" property is required',
  TYPES_REQUIRED: "body should have required property 'types'",
  PREAUTH_TYPES_MAY_NOT_BE_SPECIFIED:
    "body may not have property 'types' when 'identificationMode' is set to 'preauth'",
  PREAUTH_TYPES_MAY_NOT_BE_SET_ISSUING_DEFAULT:
    "body may not have property 'setIssuingDefault' when 'identificationMode' is set to 'preauth'",
  PRESENTATION_DEFINITION_XOR_TYPES:
    "body may only have one property of 'types' or 'presentationDefinition'",
  PRESENTATION_DEFINITION_GROUP_IF_SUBMISSION_REQUIREMENTS:
    'presentationDefinition input_descriptors[*].group is required when submission_requirements are sent',
  ISSUING_FEED_NOT_SUPPORTED: 'Issuing feeds are not supported',
};

module.exports = { DisclosureErrors };
