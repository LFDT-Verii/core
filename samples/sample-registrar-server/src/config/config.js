/*
 * Copyright 2025 Velocity Team
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
const {
  createConfig: configureCredentialTypeEndpoints,
} = require('@verii/endpoints-credential-types-registrar');
const {
  createConfig: configureOrganizationEndpoints,
} = require('@verii/endpoints-organizations-registrar');
const {
  createConfig: configureEventProcessingEndpoints,
} = require('@verii/endpoints-event-processing');
const packageJson = require('../../package.json');

const credentialTypeEndpointsConfig =
  configureCredentialTypeEndpoints(packageJson);
const organizationEndpointsConfig = configureOrganizationEndpoints(packageJson);
const eventProcessingEndpointsConfig =
  configureEventProcessingEndpoints(packageJson);

const swaggerInfo = {
  info: {
    title: 'VNF Oracle',
    version: packageJson.version,
  },
  tags: [
    ...credentialTypeEndpointsConfig.swaggerInfo.tags,
    ...organizationEndpointsConfig.swaggerInfo.tags,
    ...eventProcessingEndpointsConfig.swaggerInfo.tags,
  ],
  components: {
    securitySchemes: {
      ...credentialTypeEndpointsConfig.swaggerInfo.components.securitySchemes,
      ...organizationEndpointsConfig.swaggerInfo.components.securitySchemes,
      ...eventProcessingEndpointsConfig.swaggerInfo.components.securitySchemes,
    },
  },
};

module.exports = {
  ...credentialTypeEndpointsConfig,
  ...organizationEndpointsConfig,
  ...eventProcessingEndpointsConfig,
  swaggerInfo,
};
