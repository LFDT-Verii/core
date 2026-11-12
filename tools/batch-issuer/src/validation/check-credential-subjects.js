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
const addFormats = require('ajv-formats');
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
const {
  cloneDeep,
  difference,
  filter,
  flatMap,
  flow,
  forEach,
  get,
  includes,
  isEmpty,
  map,
  uniq,
  uniqBy,
  zipObject,
} = require('lodash/fp');
const {
  operatorApiAjvFormats,
} = require('@verii/credentialing-hub-operator-api');
const { initValidation, wrapValidationError } = require('@verii/validation');

// credentials/create checks a credentialSubject with the validation plugin's
// AJV: Ajv2019 with the draft-07 meta-schema, the Hub's formats, and the
// credentials controller's options. It reports every error rather than the
// first, which doesn't change what's valid.
const initSubjectValidation = () => {
  const ajv = new Ajv2019({
    useDefaults: true,
    strictTypes: false,
    allErrors: true,
  });
  ajv.addMetaSchema(draft7MetaSchema);
  addFormats(ajv, operatorApiAjvFormats);
  return initValidation(ajv);
};

const loadSubjectValidators = async (metadatas, registrar) => {
  const schemas = await Promise.all(
    map(({ schemaUrl }) => registrar.getSchema(schemaUrl), metadatas),
  );
  const { addDocSchema, getDocValidator } = initSubjectValidation();
  forEach((schema) => addDocSchema(schema, true), schemas);
  const validators = map(({ $id }) => getDocValidator($id), schemas);
  return zipObject(map('credentialType', metadatas), validators);
};

// The validator applies schema defaults to what it checks, so it checks a copy.
const checkSubject =
  (row, validators) =>
  ({ template, type, credential }) => {
    const validateSubject = get([type], validators);
    const subject = cloneDeep(credential.content.credentialSubject);
    if (validateSubject == null || validateSubject(subject)) {
      return [];
    }
    return map(
      (error) => ({
        row,
        template,
        reason: wrapValidationError([error], 'credentialSubject').message,
      }),
      validateSubject.errors,
    );
  };

const isRendered = ({ errors }) => isEmpty(errors);

const checkRowSubjects =
  (validators) =>
  ({ row, credentials }) =>
    flow(
      filter(isRendered),
      flatMap(checkSubject(row, validators)),
    )(credentials);

/**
 * Step 3: checks each credential's credentialSubject against its type's
 * schema from the registrar, as credentials/create does. Credentials that
 * didn't render are skipped.
 * @param {Array<object>} rows the checked rows, from step 2
 * @param {Array<object>} templates the spec's templates
 * @param {{ getCredentialTypeMetadata: Function, getSchema: Function }} registrar the registrar client
 * @returns {Promise<Array<object>>} the errors
 */
const checkCredentialSubjects = async (rows, templates, registrar) => {
  const types = flow(map('type'), uniq)(templates);
  if (isEmpty(types)) {
    return [];
  }
  const metadatas = await registrar.getCredentialTypeMetadata(types);
  const foundMetadatas = flow(
    filter(({ credentialType }) => includes(credentialType, types)),
    uniqBy('credentialType'),
  )(metadatas);
  const foundTypes = map('credentialType', foundMetadatas);
  const missingTypeErrors = map(
    (type) => ({ reason: `the registrar has no credential type ${type}` }),
    difference(types, foundTypes),
  );
  const validators = await loadSubjectValidators(foundMetadatas, registrar);
  return [...missingTypeErrors, ...flatMap(checkRowSubjects(validators), rows)];
};

module.exports = { checkCredentialSubjects };
