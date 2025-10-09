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

const createError = require('http-errors');
const { reduce, isEmpty, first, includes } = require('lodash/fp');
const { jwtDecode } = require('@verii/jwt');
const { validatePresentationContext } = require('@verii/verii-verification');
const { getJsonAtPath } = require('../../common');
const {
  ExchangeErrorCodeState,
  ensureExchangeStateValid,
} = require('../../exchanges');
const { IdentificationMethods } = require('../../disclosures');
const { PresentationErrors } = require('./errors');

const validatePresentation = async (presentation, disclosure, context) => {
  validatePresentationContext(presentation, context);
  ensureExchangeStateValid(ExchangeErrorCodeState.EXCHANGE_INVALID, context);
  crossValidateVp(presentation, context);
  validateVendorOriginContext(presentation, disclosure);
  return buildCanonicalVp(presentation);
};

const crossValidateVp = (presentation, { exchange }) => {
  const { presentation_submission: presentationSubmission } = presentation;

  if (presentationSubmission.definition_id == null) {
    return;
  }

  const [exchangeId, disclosureId] =
    presentationSubmission.definition_id.split('.');

  if (exchange?._id.toString() !== exchangeId) {
    throw createError(400, 'Mismatched Exchange Ids', {
      exchange,
      presentationSubmission,
      errorCode: 'presentation_mismatch_exchange',
    });
  }
  if (exchange?.disclosureId.toString() !== disclosureId) {
    throw createError(400, 'Mismatched Disclosure Ids', {
      exchange,
      presentationSubmission,
      errorCode: 'presentation_mismatch_disclosure',
    });
  }
};

const validateVendorOriginContext = ({ vendorOriginContext }, disclosure) => {
  if (
    !includes(IdentificationMethods.PREAUTH, disclosure.identificationMethods)
  ) {
    return;
  }
  if (isEmpty(vendorOriginContext)) {
    throw createError(
      401,
      PresentationErrors.PRESENTATION_PREAUTH_MUST_CONTAIN_VENDOR_ORIGIN_CONTEXT,
      { errorCode: 'presentation_request_invalid' }
    );
  }
};

const buildCanonicalVp = ({
  presentation_submission: presentationSubmission,
  ...json
}) =>
  reduce(
    (acc, descriptor) => {
      if (!['jwt_vc', 'jwt_vp', 'JWT'].includes(descriptor.format)) {
        throw createError(
          400,
          "Velocity Presentation Submission only supports 'jwt_vc' or 'jwt_vp' inputs",
          { errorCode: 'presentation_missing_jwtvc_or_jwtvp' }
        );
      }
      const result = getJsonAtPath(descriptor.path, json);
      if (isEmpty(result)) {
        throw createError(
          400,
          'Velocity Presentation contains path descriptor that is empty',
          { descriptor, json, errorCode: 'presentation_jsonpath_empty' }
        );
      }
      const jwtString = first(result);

      if (isEmpty(jwtString)) {
        return acc;
      }

      const { payload } = jwtDecode(jwtString);
      if (payload.vc) {
        acc.verifiableCredential.push(jwtString);
      } else {
        acc.verifiableCredential = acc.verifiableCredential.concat(
          payload.vp.verifiableCredential
        );
      }

      return acc;
    },
    {
      id: json.id,
      verifiableCredential: [],
      vendorOriginContext: json.vendorOriginContext,
      presentationIssuer: json?.issuer?.id,
    },
    presentationSubmission.descriptor_map
  );

module.exports = { validatePresentation };
