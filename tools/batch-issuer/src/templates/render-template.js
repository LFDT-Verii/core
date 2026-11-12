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

const Handlebars = require('handlebars');
const {
  cond,
  constant,
  flatMap,
  flow,
  get,
  has,
  isArray,
  isNil,
  isPlainObject,
  isString,
  map,
  mapValues,
  memoize,
  reject,
  stubTrue,
  values,
} = require('lodash/fp');
const { convertValue } = require('../values/convert-value');
const { MISSING } = require('../validation/reasons');

// A separate environment, so no helper or partial registered elsewhere applies.
const handlebars = Handlebars.create();

// Strict, so a missing column is an error rather than an empty string. Values
// aren't HTML-escaped, because they end up in JSON strings, not in HTML.
const COMPILE_OPTIONS = { strict: true, noEscape: true };

const compile = memoize((text) => handlebars.compile(text, COMPILE_OPTIONS));

// A value that is exactly one placeholder, `{{column}}` or `{{[a column]}}`.
const PLACEHOLDER = /^\{\{\s*(?:\[([^\]]+)\]|([^\s{}[\]]+))\s*\}\}$/;

// Handlebars' strict mode names the missing variable in its message.
const MISSING_VARIABLE = /^"(.+)" not defined in /;

// Strict mode finds a variable with `in`, so a name that every object
// inherits, such as "constructor", would render as an empty string rather than
// be missing. The row's values get a prototype that has nothing but the
// toString that strict mode's message uses.
const ROW_PROTOTYPE = { __proto__: null, toString: () => 'the row' };

const toRowScope = (data) => ({ __proto__: ROW_PROTOTYPE, ...data });

const placeholderColumn = (text) => {
  const match = PLACEHOLDER.exec(text);
  return match == null ? undefined : (match[1] ?? match[2]);
};

const renderError = (error) => {
  const match = MISSING_VARIABLE.exec(error.message);
  return match == null
    ? { reason: error.message }
    : { column: match[1], reason: MISSING };
};

const renderText = (text, data) => {
  try {
    return { value: compile(text)(data), errors: [] };
  } catch (error) {
    return { errors: [renderError(error)] };
  }
};

// A placeholder of a typed column takes the column's type.
const renderTyped = (column, data, columns) => {
  if (!has([column], data)) {
    return { errors: [{ column, reason: MISSING }] };
  }
  const { value, reason } = convertValue(
    get([column], columns),
    get([column], data),
  );
  return reason == null
    ? { value, errors: [] }
    : { errors: [{ column, reason }] };
};

const renderString = (text, { data, columns }) => {
  const column = placeholderColumn(text);
  return column != null && has([column], columns)
    ? renderTyped(column, data, columns)
    : renderText(text, data);
};

const renderArray = (scope) => (array) => {
  const results = map(renderNode(scope), array);
  return { value: map('value', results), errors: flatMap('errors', results) };
};

const renderObject = (scope) => (object) => {
  const results = mapValues(renderNode(scope), object);
  return {
    value: mapValues('value', results),
    errors: flow(values, flatMap('errors'))(results),
  };
};

const keepValue = (value) => ({ value, errors: [] });

const renderNode = (scope) =>
  cond([
    [isString, (text) => renderString(text, scope)],
    [isArray, renderArray(scope)],
    [isPlainObject, renderObject(scope)],
    [stubTrue, keepValue],
  ]);

/**
 * Renders a JSON template value by value. Each string is rendered with
 * Handlebars on its own, so a CSV value can only ever become part of a string,
 * never change the JSON's structure. A string that is exactly `{{column}}`
 * takes the column's type from `columns`. Keys, numbers, booleans and nulls are
 * kept as they are.
 * @param {unknown} template the parsed JSON template, or a single string
 * @param {object} data the values by column
 * @param {object} [columns] the declared type of each typed column
 * @returns {{ value: unknown, errors: Array<{ column?: string, reason: string }> }}
 *   the rendered value, which is only complete when there are no errors
 */
const renderTemplate = (template, data, columns = {}) =>
  renderNode({ data: toRowScope(data), columns })(template);

// Every string in a template, for checking their syntax once.
const templateStrings = cond([
  [isString, (text) => [text]],
  [isArray, (array) => flatMap(templateStrings, array)],
  [isPlainObject, (object) => flatMap(templateStrings, values(object))],
  [stubTrue, constant([])],
]);

const syntaxError = (text) => {
  try {
    handlebars.parse(text);
    return undefined;
  } catch (error) {
    return error.message;
  }
};

/**
 * Checks the Handlebars syntax of every string in a template.
 * @param {unknown} template the parsed JSON template, or a single string
 * @returns {Array<string>} the syntax errors
 */
const checkTemplateSyntax = flow(
  templateStrings,
  map(syntaxError),
  reject(isNil),
);

module.exports = { checkTemplateSyntax, renderTemplate };
