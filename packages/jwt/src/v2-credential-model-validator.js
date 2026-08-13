/**
 * Copyright 2026 Velocity Team
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

const Ajv2019 = require('ajv/dist/2019');
const ajvFormats = require('ajv-formats');
const v2CoreSchema = require('./schemas/vc-v2-core.schema.json');
const velocityV2JoseProfileSchema = require('./schemas/velocity-vc-v2-jose-profile.schema.json');

const V2CredentialModelViolationTypes = Object.freeze({
  COMPATIBILITY_CLAIM: 'compatibility-claim',
  CONTEXT: 'context',
  DATE_TIME: 'date-time',
  MODEL: 'model',
  PROFILE: 'profile',
  SCHEMA: 'schema',
});

const ajv = new Ajv2019({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: true,
  strictTuples: false,
  useDefaults: false,
});
ajvFormats(ajv);
ajv.addSchema(v2CoreSchema);

const validateV2CoreCredential = ajv.getSchema(v2CoreSchema.$id);
const validateVelocityV2Credential = ajv.compile(velocityV2JoseProfileSchema);

const getV2CoreCredentialModelViolation = (credential) => {
  if (!validateV2CoreCredential(credential)) {
    return violationFromCoreErrors(validateV2CoreCredential.errors);
  }
  const invalidDateTime = invalidDateTimeProperty(credential);
  if (invalidDateTime != null) {
    return {
      property: invalidDateTime,
      type: V2CredentialModelViolationTypes.DATE_TIME,
    };
  }
  if (hasReversedValidityInterval(credential)) {
    return {
      property: 'validUntil',
      type: V2CredentialModelViolationTypes.DATE_TIME,
    };
  }
  return undefined;
};

const getV2CredentialModelViolation = (credential) =>
  getV2CoreCredentialModelViolation(credential) ??
  getVelocityV2CredentialModelViolation(credential);

const getVelocityV2CredentialModelViolation = (credential) => {
  if (validateVelocityV2Credential(credential)) {
    return undefined;
  }

  return violationFromProfileErrors(validateVelocityV2Credential.errors);
};

const isV2CoreCredential = (credential) => validateV2CoreCredential(credential);

const isVelocityV2Credential = (credential) =>
  validateVelocityV2Credential(credential);

const hasReversedValidityInterval = ({ validFrom, validUntil }) =>
  validFrom != null &&
  validUntil != null &&
  Date.parse(validUntil) < Date.parse(validFrom);

const invalidDateTimeProperty = (credential) =>
  ['validFrom', 'validUntil'].find(
    (property) =>
      credential[property] != null &&
      !Number.isFinite(Date.parse(credential[property])),
  );

const violationFromCoreErrors = (errors) => {
  if (hasPropertyError(errors, '@context')) {
    return { type: V2CredentialModelViolationTypes.CONTEXT };
  }
  if (hasPropertyError(errors, 'credentialSchema')) {
    return { type: V2CredentialModelViolationTypes.SCHEMA };
  }
  const compatibilityClaim = ['vc', 'vp'].find((property) =>
    hasPropertyError(errors, property),
  );
  if (compatibilityClaim != null) {
    return {
      property: compatibilityClaim,
      type: V2CredentialModelViolationTypes.COMPATIBILITY_CLAIM,
    };
  }
  const dateTime = ['validFrom', 'validUntil'].find((property) =>
    hasPropertyError(errors, property),
  );
  if (dateTime != null) {
    return {
      property: dateTime,
      type: V2CredentialModelViolationTypes.DATE_TIME,
    };
  }
  return { type: V2CredentialModelViolationTypes.MODEL };
};

const violationFromProfileErrors = (errors) => ({
  property: ['id', 'validFrom'].find((property) =>
    hasPropertyError(errors, property),
  ),
  type: V2CredentialModelViolationTypes.PROFILE,
});

const hasPropertyError = (errors, property) =>
  errors.some(
    ({ instancePath, params }) =>
      instancePath === `/${property}` ||
      instancePath.startsWith(`/${property}/`) ||
      params?.missingProperty === property,
  );

module.exports = {
  V2CredentialModelViolationTypes,
  getV2CoreCredentialModelViolation,
  getV2CredentialModelViolation,
  getVelocityV2CredentialModelViolation,
  isV2CoreCredential,
  isVelocityV2Credential,
};
