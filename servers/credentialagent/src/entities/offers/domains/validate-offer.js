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
const { omit } = require('lodash/fp');
const { extractCredentialType } = require('@verii/vc-checks');
const {
  newVendorOfferSchema,
} = require('../../../controllers/operator/tenants/_tenantId/offers/schemas');
const { initLoadSchemaValidate } = require('../../schemas');
const {
  validateOfferCommercialEntity,
} = require('./validate-offer-commercial-entity');

const initValidateOffer = (fastify) => {
  const vendorOfferValidator = fastify.getDocValidator(
    newVendorOfferSchema.$id
  );

  const createSchemaValidator = initLoadSchemaValidate(fastify);

  const createValidationError = (validator, path = '$') => {
    return newError.BadRequest(
      fastify.errorsText(validator.errors, { dataVar: `'${path}'` })
    );
  };

  return async (
    offer,
    isValidateVendorOffer,
    forceCredentialSubjectValidation,
    context
  ) => {
    if (isValidateVendorOffer && !vendorOfferValidator(offer)) {
      throw createValidationError(vendorOfferValidator);
    }

    validateExpirationDates(offer);
    validateOfferCommercialEntity(offer, context.disclosure);

    const credentialSubject = omit(['vendorUserId'], offer.credentialSubject);
    const validator = await createSchemaValidator(
      extractCredentialType(offer),
      context
    );
    validator(credentialSubject);
    const validatedOffer = {
      ...offer,
      credentialSubject: {
        vendorUserId: offer.credentialSubject?.vendorUserId,
        ...credentialSubject,
      },
    };
    // skip validating credential subjects if the config is off
    if (
      !context.config.enableOfferValidation &&
      !forceCredentialSubjectValidation
    ) {
      return validatedOffer;
    }

    if (!validator(credentialSubject)) {
      throw createValidationError(validator, '$.credentialSubject');
    }
    return validatedOffer;
  };
};

const validateExpirationDates = (offer) => {
  if (offer.expirationDate != null && offer.validUntil != null) {
    throw newError.BadRequest(
      "'$.expirationDate' and '$.validUntil' cannot both be set"
    );
  }
};

module.exports = { initValidateOffer };
