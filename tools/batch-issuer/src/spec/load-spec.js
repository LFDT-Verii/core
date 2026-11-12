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

const toSchemaError = (error) => ({
  reason: `${specPath(error.instancePath)} ${error.message}${errorDetail(error)}`,
});

const checkSchema = (spec) =>
  validateSpecSchema(spec) ? [] : map(toSchemaError, validateSpecSchema.errors);

// A holder who opens the link before their credentials exist would otherwise
// get nothing to wait for.
const checkDepotOnly = (spec) =>
  has('credentials', spec) ||
  get(['depot', 'deferredCredentials'], spec) === true
    ? []
    : [
        {
          reason:
            'a spec without credentials loads depots only, so it needs depot.deferredCredentials: true',
        },
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
    (reason) => ({ reason: `the spec has a template error: ${reason}` }),
    syntaxErrors,
  );
};

const checkTemplateType = ({ template: name, type }) => {
  if (!isString(type) || isEmpty(type)) {
    return [{ reason: `template ${name} has no credential type` }];
  }
  return includes('{{', type)
    ? [{ reason: `template ${name}'s type must not be a Handlebars template` }]
    : [];
};

const checkTemplateContent = (template) => {
  const syntaxErrors = map(
    (reason) => ({
      reason: `template ${template.template} has a template error: ${reason}`,
    }),
    checkTemplateSyntax(template.content),
  );
  return [...checkTemplateType(template), ...syntaxErrors];
};

// JSON.parse throws a SyntaxError. Any other error is from reading the file.
const loadTemplate = (specDir) => async (credential) => {
  const name = credential.template;
  try {
    const text = await readFile(path.resolve(specDir, name), 'utf8');
    const content = JSON.parse(text);
    if (!isPlainObject(content)) {
      return { errors: [{ reason: `template ${name} is not a JSON object` }] };
    }
    const type = extractCredentialType(content);
    const template = { ...credential, content, type };
    return { template, errors: checkTemplateContent(template) };
  } catch (error) {
    const problem =
      error instanceof SyntaxError ? 'is not valid JSON' : "can't be read";
    return {
      errors: [{ reason: `template ${name} ${problem}: ${error.message}` }],
    };
  }
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
  try {
    const spec = YAML.parse(text);
    return { spec, errors: checkSchema(spec) };
  } catch (error) {
    if (!(error instanceof YAML.YAMLParseError)) {
      throw error;
    }
    return {
      errors: [{ reason: `the spec is not valid YAML: ${error.message}` }],
    };
  }
};

/**
 * Reads a spec file and loads its templates, and checks them all.
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
