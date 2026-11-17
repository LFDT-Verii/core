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
  fetchJson,
  getCredentialTypeMetadata,
} = require('@verii/common-fetchers');
const { initClient } = require('./init-client');

/**
 * A client of the registrar, for credential types and their schemas, which
 * credentials/create loads the same way.
 * @param {{ registrar: string }} options the registrar's base URL
 */
const initRegistrarClient = ({ registrar }) => {
  const registrarFetch = initClient({ prefixUrl: registrar });
  return {
    getCredentialTypeMetadata: (credentialTypes) =>
      getCredentialTypeMetadata(credentialTypes, { registrarFetch }),
    getSchema: (schemaUrl) => fetchJson(schemaUrl, { fetch: registrarFetch }),
  };
};

module.exports = { initRegistrarClient };
