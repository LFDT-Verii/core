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
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
const { initValidation } = require('./validation');

/**
 * Builds the validation functions of `initValidation` on an Ajv2019 instance
 * that also accepts draft-07 schemas, such as credential type schemas.
 * @param {object} [ajvOptions] the Ajv options
 * @param {Array<string>} [formats] the ajv-formats formats to add. All of them when missing
 * @returns {object} the validation functions of `initValidation`
 */
const initAjv2019Validation = (ajvOptions, formats) => {
  const ajv = new Ajv2019(ajvOptions);
  ajv.addMetaSchema(draft7MetaSchema);
  ajvFormats(ajv, formats);
  return initValidation(ajv);
};

module.exports = { initAjv2019Validation };
