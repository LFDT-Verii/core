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

const {
  countBy,
  flatMap,
  flow,
  identity,
  includes,
  isEmpty,
  isUndefined,
  keys,
  map,
  omitBy,
  partition,
  pickBy,
  set,
  size,
  uniqBy,
} = require('lodash/fp');
const {
  initOperatorApiValidator,
} = require('@verii/credentialing-hub-operator-api');
const { wrapValidationError } = require('@verii/validation');
const { renderTemplate } = require('../templates/render-template');
const { buildAuthValues } = require('../values/auth-values');
const {
  findDuplicateAuthValues,
  findDuplicateCredentialReferences,
} = require('./find-duplicates');
const { MISSING } = require('./reasons');

const operatorApi = initOperatorApiValidator();

// Validates as the Hub does, with the package's validator, which reports the
// first error in Fastify's format, such as "depot/userReference must be string".
const checkOperatorApiSchema = (schemaId, data, dataVar) => {
  const errors = operatorApi.validate(schemaId, data);
  return isEmpty(errors)
    ? []
    : [{ reason: wrapValidationError(errors, dataVar).message }];
};

const checkCellCount = ({ cellCount }, { headers }) =>
  cellCount > size(headers)
    ? [
        {
          reason: `has ${cellCount} cells, but the header has ${size(headers)} columns`,
        },
      ]
    : [];

// Without authColumns the spec doesn't fit the service, so there are no auth
// values to check.
const buildRowAuthValues = ({ authColumns, options }, data) =>
  authColumns == null
    ? { errors: [] }
    : buildAuthValues(authColumns, data, options);

// A service without auth rules takes depots without authValues.
const buildDepot = (spec, userReference, authValues) =>
  omitBy(isUndefined, {
    userReference,
    authValues: isEmpty(authValues) ? undefined : authValues,
    expectedCredentialTypes: spec.depot.expectedCredentialTypes,
    deferredCredentials: spec.depot.deferredCredentials,
  });

// userReference, credentialReference and tags are strings, so they're
// rendered without the typed columns.
const renderDepot = ({ spec }, data, authValues) => {
  const { value: userReference, errors } = renderTemplate(
    spec.depot.userReference,
    data,
  );
  if (!isEmpty(errors)) {
    return { errors };
  }
  const depot = buildDepot(spec, userReference, authValues);
  return { depot, errors: checkOperatorApiSchema('new-depot', depot, 'depot') };
};

const renderCredential =
  ({ spec }, data) =>
  (template) => {
    const content = renderTemplate(template.content, data, spec.columns);
    const reference = renderTemplate(template.credentialReference, data);
    const tags = renderTemplate(template.tags, data);
    const renderErrors = [
      ...content.errors,
      ...reference.errors,
      ...tags.errors,
    ];
    const credential = omitBy(isUndefined, {
      credentialReference: reference.value,
      content: content.value,
      tags: tags.value,
    });
    const errors = isEmpty(renderErrors)
      ? checkOperatorApiSchema('new-credential', credential, 'credential')
      : renderErrors;
    return {
      template: template.template,
      type: template.type,
      credential,
      errors: map(set('template', template.template), errors),
    };
  };

// --var values override the CSV's values of the same name.
const checkRow = (context) => (csvRow) => {
  const data = { ...csvRow.data, ...context.vars };
  const auth = buildRowAuthValues(context, data);
  const depot = renderDepot(context, data, auth.authValues);
  const credentials = map(renderCredential(context, data), context.templates);
  const errors = [
    ...checkCellCount(csvRow, context.csv),
    ...auth.errors,
    ...depot.errors,
    ...flatMap('errors', credentials),
  ];
  return {
    row: csvRow.row,
    depot: depot.depot,
    authValues: auth.authValues,
    credentials,
    errors,
  };
};

const checkHeaders = (headers, rows) => {
  const duplicateHeaders = flow(
    countBy(identity),
    pickBy((count) => count > 1),
    keys,
  )(headers);
  const duplicateErrors = map(
    (column) => ({ column, reason: 'is in the header more than once' }),
    duplicateHeaders,
  );
  return isEmpty(rows)
    ? [{ reason: 'the CSV has no rows' }, ...duplicateErrors]
    : duplicateErrors;
};

// A column that's missing from every row, because the CSV doesn't have it, is
// one error rather than one for each row.
const liftAbsentColumns = (rowErrors, knownColumns) => {
  const isAbsentColumn = ({ column, reason }) =>
    reason === MISSING && !includes(column, knownColumns);
  const [absent, present] = partition(isAbsentColumn, rowErrors);
  const absentErrors = flow(
    uniqBy('column'),
    map(({ column }) => ({
      column,
      reason: 'is used by the spec, but the CSV has no such column',
    })),
  )(absent);
  return [...absentErrors, ...present];
};

const errorsOfRow = ({ row, errors }) =>
  map((error) => ({ row, ...error }), errors);

// Step 2: each row against the spec, and the rows against each other.
const checkRows = (context) => {
  const { csv, vars, authColumns } = context;
  const rows = map(checkRow(context), csv.rows);
  const rowErrors = flatMap(errorsOfRow, rows);
  const knownColumns = [...csv.headers, ...keys(vars)];
  const errors = [
    ...checkHeaders(csv.headers, csv.rows),
    ...liftAbsentColumns(rowErrors, knownColumns),
    ...findDuplicateAuthValues(rows, authColumns),
    ...findDuplicateCredentialReferences(rows),
  ];
  return { rows, errors };
};

module.exports = { checkRows };
