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

const { endsWith, kebabCase } = require('lodash/fp');

const KEBAB_CASE_VERSIONED_SCHEMA = /-v-(\d)-(\d)$/;

const normalizeSchemaNameCandidate = (fileSuffix) => (schemaName) => {
  if (endsWith(fileSuffix, schemaName)) {
    return schemaName.slice(0, -fileSuffix.length);
  }
  const schemaNameKebab = kebabCase(schemaName);
  if (KEBAB_CASE_VERSIONED_SCHEMA.test(schemaNameKebab)) {
    const [, majorVersion, minorVersion] =
      KEBAB_CASE_VERSIONED_SCHEMA.exec(schemaNameKebab);
    return schemaNameKebab.replace(
      KEBAB_CASE_VERSIONED_SCHEMA,
      `-v${majorVersion}.${minorVersion}`
    );
  }

  return schemaNameKebab;
};
module.exports = {
  normalizeJsonSchemaName: normalizeSchemaNameCandidate('.schema.json'),
  normalizeFormSchemaName: normalizeSchemaNameCandidate('.form-schema.json'),
  normalizeDisplayDescriptorName:
    normalizeSchemaNameCandidate('.descriptor.json'),
};
