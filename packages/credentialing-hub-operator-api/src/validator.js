/*
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
 *
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { forEach, isEmpty } = require('lodash/fp');
const {
  newOfferRelatedResourceSchema,
  w3cVcSchema,
} = require('@verii/common-schemas');
const { initValidation, wrapValidationError } = require('@verii/validation');
const {
  findDepotsRequestSchema,
  newCredentialSchema,
  newDepotSchema,
  newIssuerServiceSchema,
} = require('./schemas');

// The defaults of @fastify/ajv-compiler, which builds the Hub's validators.
// The Hub's options below override all but addUsedSchema.
const FASTIFY_AJV_DEFAULTS = {
  coerceTypes: 'array',
  useDefaults: true,
  removeAdditional: true,
  addUsedSchema: false,
  allErrors: false,
};

// The Hub's `ajvOptions`. A Hub test checks they stay the same.
const operatorApiAjvOptions = Object.freeze({
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
  allErrors: false,
  strictTypes: 'log',
});

// The Hub's `ajvFormats`, which it takes from @verii/config. A Hub test checks
// they stay the same.
const operatorApiAjvFormats = Object.freeze([
  'uri',
  'uri-reference',
  'iri',
  'iri-reference',
  'date',
  'date-time',
  'regex',
  'email',
  'duration',
]);

// Schemas that the request schemas $ref
const REFERENCED_SCHEMAS = [newOfferRelatedResourceSchema, w3cVcSchema];

const REQUEST_SCHEMAS = [
  newIssuerServiceSchema,
  newDepotSchema,
  newCredentialSchema,
  findDepotsRequestSchema,
];

/**
 * Builds a validator for the Hub's operator API request schemas
 * (`new-issuer-service`, `new-depot`, `new-credential` and
 * `find-depots-request`), with the AJV
 * options and formats the Hub uses, so a client accepts what the Hub accepts.
 * It never changes the data: defaults aren't applied and types aren't coerced.
 * @returns {{
 *   validate: (schemaId: string, data: unknown) => Array<object>,
 *   assertValid: (schemaId: string, data: unknown, dataVar?: string) => unknown,
 * }} the validator
 */
const initOperatorApiValidator = () => {
  const ajv = new Ajv({ ...FASTIFY_AJV_DEFAULTS, ...operatorApiAjvOptions });
  addFormats(ajv, operatorApiAjvFormats);
  const { addDocSchema, getDocValidator } = initValidation(ajv);
  forEach(addDocSchema, [...REFERENCED_SCHEMAS, ...REQUEST_SCHEMAS]);

  const getValidator = (schemaId) => {
    const validateFn = getDocValidator(schemaId);
    if (validateFn == null) {
      throw new Error(`Unknown operator API schema "${schemaId}"`);
    }
    return validateFn;
  };

  /**
   * Validates data against a schema.
   * @param {string} schemaId the schema's `$id`, for example `new-depot`
   * @param {unknown} data the data to validate
   * @returns {Array<object>} the AJV errors, or an empty array when the data is valid
   */
  const validate = (schemaId, data) => {
    const validateFn = getValidator(schemaId);
    return validateFn(data) ? [] : validateFn.errors;
  };

  /**
   * Validates data against a schema, and throws when it is invalid.
   * @param {string} schemaId the schema's `$id`, for example `new-depot`
   * @param {unknown} data the data to validate
   * @param {string} [dataVar] the prefix of the error message. Defaults to the schema's `$id`
   * @returns {unknown} the data, when it is valid
   * @throws {Error} a 400 error with the message format and `validation` errors that Fastify gives
   */
  const assertValid = (schemaId, data, dataVar = schemaId) => {
    const errors = validate(schemaId, data);
    if (!isEmpty(errors)) {
      throw wrapValidationError(errors, dataVar);
    }
    return data;
  };

  return { validate, assertValid };
};

module.exports = {
  initOperatorApiValidator,
  operatorApiAjvFormats,
  operatorApiAjvOptions,
};
