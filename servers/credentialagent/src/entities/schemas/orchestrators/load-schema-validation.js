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

const newError = require('http-errors');
const {
  getCredentialTypeMetadata,
  fetchJson,
} = require('@verii/common-fetchers');
const { isEmpty, first } = require('lodash/fp');

const initLoadSchemaValidate = ({
  addDocSchema,
  hasDocSchema,
  getDocValidator,
}) => {
  const loadCredentialTypeFromRegistrar = async (credentialType, context) => {
    const credentialTypeMetadataList = await getCredentialTypeMetadata(
      [credentialType],
      context,
    );
    if (isEmpty(credentialTypeMetadataList)) {
      throw newError.BadRequest(
        `${credentialType} is not a recognized credential type`,
      );
    }
    return first(credentialTypeMetadataList);
  };

  const loadSchemaFromRegistrar = async (schemaUrl, context) => {
    try {
      return await fetchJson(schemaUrl, context);
    } catch {
      throw newError.BadGateway(`failed to resolve ${schemaUrl}`);
    }
  };
  return async (credentialType, context) => {
    const credentialTypeMetadata = await loadCredentialTypeFromRegistrar(
      credentialType,
      context,
    );

    const schema = await loadSchemaFromRegistrar(
      credentialTypeMetadata.schemaUrl,
      context,
    );
    if (schema.$id == null) {
      throw newError.BadGateway(
        `${credentialTypeMetadata.schemaUrl} $id field missing`,
      );
    }
    if (!hasDocSchema(schema.$id)) {
      addDocSchema(schema, true);
    }
    return getDocValidator(schema.$id);
  };
};

module.exports = {
  initLoadSchemaValidate,
};
