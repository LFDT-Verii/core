/*
 * Copyright 2024 Velocity Team
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
const { map, forEach, findIndex, flow, uniq } = require('lodash/fp');
const newError = require('http-errors');
const { getCredentialTypeMetadata } = require('@verii/common-fetchers');
const { initHttpClient } = require('@verii/http-client');
const { extractCredentialType } = require('@verii/vc-checks');
const {
  initCanonicalizeCredentials,
  initValidateCredential,
  CredentialErrors,
} = require('../domain');

const createCredentials = async (credentialItems, context) => {
  const { repos } = context;

  const depotIds = flow(map('depotId'), uniq)(credentialItems);
  const credentials = map('credential', credentialItems);
  const credentialTypes = flow(
    map(({ content }) => extractCredentialType(content)),
    uniq,
  )(credentials);

  const [depots, relatedCredentials, credentialTypeMetadatas] =
    await Promise.all([
      repos.depots.findDepots(null, depotIds),
      repos.credentials.findByRelatedResources(credentials),
      getCredentialTypeMetadataWithErrorHandling(credentialTypes, context),
    ]);
  const schemas = await Promise.all(
    map(
      (credentialType) => loadSchemaWithErrorHandling(credentialType, context),
      credentialTypeMetadatas,
    ),
  );

  const validateCredential = initValidateCredential(
    depots,
    credentialTypeMetadatas,
    schemas,
    context,
  );
  const canonicalizeCredential = initCanonicalizeCredentials(
    relatedCredentials,
    credentialTypeMetadatas,
  );

  const canonicalizedCredentials = flow(
    map((item) => ({
      ...item,
      metadataIdx: findIndex(
        {
          credentialType: extractCredentialType(item.credential.content),
        },
        credentialTypeMetadatas,
      ),
    })),
    forEach(validateCredential),
    map(canonicalizeCredential),
  )(credentialItems);

  return repos.credentials.insertMany(canonicalizedCredentials);
};

const loadSchema = async (credentialTypeMetadata, context) => {
  const client = initHttpClient({
    requestTimeout: context.config.requestTimeout,
    traceIdHeader: context.config.traceIdHeader,
    rejectUnauthorized: true,
  })(context);
  const response = await client.get(credentialTypeMetadata.schemaUrl);
  return response.json();
};

const getCredentialTypeMetadataWithErrorHandling = async (
  credentialTypes,
  context,
) => {
  try {
    return await getCredentialTypeMetadata(credentialTypes, context);
  } catch (error) {
    context.log.error('Error loading credential types', error);
    throw newError(
      502,
      CredentialErrors.CREDENTIAL_TYPES_METADATA_UPSTREAM_ERROR,
      {
        errorCode: CredentialErrors.CREDENTIAL_TYPES_METADATA_UPSTREAM_ERROR,
      },
    );
  }
};

const loadSchemaWithErrorHandling = async (credentialTypeMetadata, context) => {
  try {
    return await loadSchema(credentialTypeMetadata, context);
  } catch (error) {
    context.log.error(error, { msg: 'schema loading error' });
    throw newError(502, CredentialErrors.SCHEMA_UPSTREAM_ERROR, {
      errorCode: CredentialErrors.SCHEMA_UPSTREAM_ERROR,
    });
  }
};

module.exports = { createCredentials };
