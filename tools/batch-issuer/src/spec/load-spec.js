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

const { readFile } = require('node:fs/promises');
const path = require('node:path');
const Ajv = require('ajv');
const YAML = require('yaml');
const {
  cond,
  constant,
  flatMap,
  flow,
  get,
  has,
  includes,
  isEmpty,
  isPlainObject,
  isString,
  join,
  map,
  replace,
  stubTrue,
} = require('lodash/fp');
const { extractCredentialType } = require('@verii/vc-checks');
const { specSchema } = require('./spec-schema');
const { checkTemplateSyntax } = require('../templates/render-template');

const specAjv = new Ajv({ allErrors: true });
const validateSpecSchema = specAjv.compile(specSchema);

const specError = (reason) => ({ reason });

// AJV's messages don't name an unknown property or the allowed values.
const errorDetail = cond([
  [
    has(['params', 'additionalProperty']),
    ({ params }) => `: ${params.additionalProperty}`,
  ],
  [
    has(['params', 'allowedValues']),
    ({ params }) => `: ${join(', ', params.allowedValues)}`,
  ],
  [stubTrue, constant('')],
]);

// /depot/authValues/0 becomes spec.depot.authValues.0
const specPath = flow(
  replace(/\//g, '.'),
  (instancePath) => `spec${instancePath}`,
);

const toSchemaError = (error) =>
  specError(
    `${specPath(error.instancePath)} ${error.message}${errorDetail(error)}`,
  );

const parseYaml = (text) => {
  try {
    return { spec: YAML.parse(text) };
  } catch (error) {
    return {
      errors: [specError(`the spec is not valid YAML: ${error.message}`)],
    };
  }
};

const checkSchema = (spec) =>
  validateSpecSchema(spec) ? [] : map(toSchemaError, validateSpecSchema.errors);

// A holder who opens the link before their credentials exist would otherwise
// get nothing to wait for.
const checkDepotOnly = (spec) =>
  has('credentials', spec) ||
  get(['depot', 'deferredCredentials'], spec) === true
    ? []
    : [
        specError(
          'a spec without credentials loads depots only, so it needs depot.deferredCredentials: true',
        ),
      ];

const checkSpecTemplates = (spec) => {
  const credentialStrings = flatMap(
    ({ credentialReference, tags = [] }) => [credentialReference, ...tags],
    spec.credentials,
  );
  const syntaxErrors = checkTemplateSyntax([
    spec.depot.userReference,
    ...credentialStrings,
  ]);
  return map(
    (reason) => specError(`the spec has a template error: ${reason}`),
    syntaxErrors,
  );
};

const parseTemplate = (text, name) => {
  try {
    const content = JSON.parse(text);
    return isPlainObject(content)
      ? { content }
      : { errors: [specError(`template ${name} is not a JSON object`)] };
  } catch (error) {
    return {
      errors: [
        specError(`template ${name} is not valid JSON: ${error.message}`),
      ],
    };
  }
};

const checkTemplateType = (type, name) => {
  if (!isString(type) || isEmpty(type)) {
    return [specError(`template ${name} has no credential type`)];
  }
  return includes('{{', type)
    ? [specError(`template ${name}'s type must not be a Handlebars template`)]
    : [];
};

const checkTemplateContent = (content, name) => {
  const syntaxErrors = map(
    (reason) => specError(`template ${name} has a template error: ${reason}`),
    checkTemplateSyntax(content),
  );
  return [
    ...checkTemplateType(extractCredentialType(content), name),
    ...syntaxErrors,
  ];
};

const readTemplate = async (specDir, name) => {
  try {
    return { text: await readFile(path.resolve(specDir, name), 'utf8') };
  } catch (error) {
    return {
      errors: [specError(`template ${name} can't be read: ${error.message}`)],
    };
  }
};

const loadTemplate = (specDir) => async (credential) => {
  const name = credential.template;
  const { text, errors: readErrors } = await readTemplate(specDir, name);
  if (readErrors != null) {
    return { errors: readErrors };
  }
  const { content, errors: parseErrors } = parseTemplate(text, name);
  if (parseErrors != null) {
    return { errors: parseErrors };
  }
  const template = {
    ...credential,
    content,
    type: extractCredentialType(content),
  };
  return { template, errors: checkTemplateContent(content, name) };
};

const loadTemplates = async (spec, specDir) => {
  const results = await Promise.all(
    map(loadTemplate(specDir), spec.credentials ?? []),
  );
  return {
    templates: map('template', results),
    errors: flatMap('errors', results),
  };
};

/**
 * Reads a spec file and checks it against the spec's JSON schema.
 * @param {string} specFile the YAML spec file
 * @returns {Promise<{ spec?: object, errors: Array<{ reason: string }> }>} the spec, which is only valid when there are no errors
 * @throws when the spec file can't be read
 */
const readSpec = async (specFile) => {
  const text = await readFile(specFile, 'utf8');
  const { spec, errors: yamlErrors } = parseYaml(text);
  if (yamlErrors != null) {
    return { errors: yamlErrors };
  }
  return { spec, errors: checkSchema(spec) };
};

/**
 * Reads a spec file and loads the templates it names, and checks them: the
 * spec against its JSON schema, that a depot-only spec defers credentials,
 * that each template is a JSON object with a credential type, and the
 * Handlebars syntax of every template.
 * @param {string} specFile the YAML spec file
 * @returns {Promise<{ spec?: object, templates?: Array<object>, errors: Array<{ reason: string }> }>}
 *   the spec and its templates, which are only complete when there are no errors
 * @throws when the spec file can't be read
 */
const loadSpec = async (specFile) => {
  const { spec, errors: specErrors } = await readSpec(specFile);
  if (!isEmpty(specErrors)) {
    return { errors: specErrors };
  }
  const { templates, errors: templateErrors } = await loadTemplates(
    spec,
    path.dirname(specFile),
  );
  const errors = [
    ...checkDepotOnly(spec),
    ...checkSpecTemplates(spec),
    ...templateErrors,
  ];
  return { spec, templates, errors };
};

module.exports = { loadSpec, readSpec };
