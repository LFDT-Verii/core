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

// copied from @fastify/lib/validation to standardize validation errors
const schemaErrorsText = (errors, dataVar) => {
  let text = '';
  const separator = ', ';
  for (let i = 0; i < errors.length; i += 1) {
    const e = errors[i];
    text += `${dataVar + (e.instancePath || '')} ${e.message}${separator}`;
  }
  return text.slice(0, -separator.length);
};

const wrapValidationError = (result, dataVar = '') => {
  if (result instanceof Error) {
    return result;
  }
  const error = new Error(schemaErrorsText(result, dataVar));

  // eslint-disable-next-line better-mutation/no-mutation
  error.statusCode = 400;
  // eslint-disable-next-line better-mutation/no-mutation
  error.code = 'FST_ERR_VALIDATION';
  // eslint-disable-next-line better-mutation/no-mutation
  error.validation = result;
  // eslint-disable-next-line better-mutation/no-mutation
  error.validationContext = dataVar;
  return error;
};

const initValidation = (ajv) => {
  const addDocSchema = (schema, override = false) => {
    try {
      return ajv.addSchema(schema, schema.$id);
    } catch (e) {
      if (!override) {
        throw e;
      }
      if (
        e.message === `schema with key or id "${schema.$id}" already exists`
      ) {
        ajv.removeSchema(schema.$id);
        return ajv.addSchema(schema, schema.$id);
      }
      throw e;
    }
  };

  const hasDocSchema = (schemaId) => !!ajv.getSchema(schemaId);

  const removeDocSchema = (schemaId) => ajv.removeSchema(schemaId);

  const getDocValidator = (schemaId) => ajv.getSchema(schemaId);

  const errorsText = (errors, options) => ajv.errorsText(errors, options);

  const validateDoc = (data, schemaId) => {
    const validatorFn = getDocValidator(schemaId);
    const res = validatorFn(data);
    if (res === false) {
      return validatorFn.errors;
    }
    return false;
  };

  const validateSchema = (schema) => {
    const isValid = ajv.validateSchema(schema);
    const error = !isValid ? ajv.errors[0].message : undefined;
    return { isValid, error };
  };

  const validateJSONBySchema = (json = {}, schema) => {
    const validate = ajv.compile(schema);
    const valid = validate(json);
    return {
      isValid: valid,
      error: !valid ? validate.errors[0]?.message : undefined,
    };
  };

  return {
    addDocSchema,
    getDocValidator,
    hasDocSchema,
    validateDoc,
    removeDocSchema,
    errorsText,
    validateSchema,
    validateJSONBySchema,
  };
};

module.exports = {
  initValidation,
  wrapValidationError,
};
