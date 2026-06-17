/*
 * Copyright 2025 Velocity Team
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
const { first, includes, isEmpty, castArray, omit } = require('lodash/fp');
const { JSONPath } = require('jsonpath-plus');

const VALID_PRESENTATION_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://www.w3.org/ns/credentials/v2',
];
const SUPPORTED_DESCRIPTOR_FORMATS = ['jwt_vc', 'jwt_vp'];
const SUPPORTED_NESTED_VP_TOKEN_PATHS = ['$', '$[0]'];
const presentationSchema = {
  $ref: 'https://velocitycareerlabs.io/velocity-presentation-submission.schema.json#',
};

const validatePresentation = (
  presentation,
  exchange,
  context,
  presentationSubmission = presentation.presentation_submission,
) => {
  const submittedPresentation = {
    ...presentation,
    presentation_submission: presentationSubmission,
  };
  const validateSchema = context.compileValidationSchema(presentationSchema);
  if (!validateSchema(submittedPresentation)) {
    throw newError(
      400,
      `${validateSchema.errors[0].instancePath.substring(1)} ${
        validateSchema.errors[0].message
      }`,
      {
        errorCode: 'request_validation_failed',
      },
    );
  }
  validatePresentationContext(presentation, context);
  verifyPresentationSubmissionAgainstDefinition(
    presentationSubmission,
    presentation,
  );
  verifyPresentationAgainstExchange(presentationSubmission, exchange);
};

const validatePresentationContext = (presentation) => {
  if (
    !includes(
      first(castArray(presentation?.['@context'])),
      VALID_PRESENTATION_CONTEXTS,
    )
  ) {
    throw newError(400, 'presentation @context is invalid', {
      errorCode: 'presentation_invalid',
    });
  }
};

const verifyPresentationAgainstExchange = (
  presentationSubmission,
  exchange,
) => {
  if (presentationSubmission.definition_id == null) {
    return;
  }

  const [exchangeId, disclosureId] =
    presentationSubmission.definition_id.split('.');

  if (exchange?._id.toString() !== exchangeId) {
    throw newError(400, 'Mismatched Exchange Ids', {
      exchange,
      presentationSubmission,
      errorCode: 'presentation_mismatch_exchange',
    });
  }
  if (exchange?.serviceId.toString() !== disclosureId) {
    throw newError(400, 'Mismatched Service Ids', {
      exchange,
      presentationSubmission,
      errorCode: 'presentation_mismatch_service',
    });
  }
};

const verifyPresentationSubmissionAgainstDefinition = (
  presentationSubmission,
  presentation,
) => {
  const presentationContent = omit(['presentation_submission'], presentation);
  for (const descriptor of presentationSubmission.descriptor_map) {
    validateDescriptorFormat(descriptor);
    validateDescriptorPath(descriptor);
    const result = getJsonAtPath(
      getDescriptorPath(descriptor),
      presentationContent,
    );
    if (isEmpty(result)) {
      throw newError(
        400,
        'Presentation path descriptor does not reference any valid data: JSONPath expression returned no results',
        {
          descriptor,
          json: presentationContent,
          errorCode: 'presentation_jsonpath_empty',
        },
      );
    }
  }
};

const validateDescriptorFormat = (descriptor) => {
  if (!SUPPORTED_DESCRIPTOR_FORMATS.includes(descriptor.format)) {
    throw newError(
      400,
      "Velocity Presentation Submission only supports 'jwt_vc' or 'jwt_vp' inputs",
      { errorCode: 'presentation_missing_jwtvc_or_jwtvp' },
    );
  }
};

const validateDescriptorPath = (descriptor) => {
  if (descriptor.path_nested != null) {
    if (descriptor.path_nested.path_nested != null) {
      throw newError(
        400,
        'Presentation path descriptor uses unsupported recursive nested paths',
        {
          descriptor,
          errorCode: 'presentation_jsonpath_unsupported',
        },
      );
    }
    validateDescriptorFormat(descriptor.path_nested);
  }
  if (
    descriptor.path_nested != null &&
    !SUPPORTED_NESTED_VP_TOKEN_PATHS.includes(descriptor.path)
  ) {
    throw newError(
      400,
      'Presentation path descriptor uses an unsupported nested VP-token path',
      {
        descriptor,
        errorCode: 'presentation_jsonpath_unsupported',
      },
    );
  }
};

const getDescriptorPath = (descriptor) =>
  descriptor.path_nested?.path ?? descriptor.path;

const getJsonAtPath = (path, json) =>
  JSONPath({
    path,
    json,
    preventEval: true,
  });

module.exports = {
  validatePresentation,
};
