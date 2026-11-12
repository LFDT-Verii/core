/*
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
 *
 */

const env = require('env-var');
const { getOr } = require('lodash/fp');

// The network name each NODE_ENV gave the registrar's emails
const registrarNetworkNames = {
  development: 'LocalDevNet',
  test: 'LocalDevNet',
  dev: 'DevNet',
  staging: 'TestNet',
  production: 'MainNet',
};

/**
 * Defaults for the settings that replaced checks on NODE_ENV (#1234), by variable name.
 *
 * Each default is what NODE_ENV gave that behaviour before, so nothing changes until a
 * deployment sets the variable. Under NODE_ENV=production an unset variable gets production
 * behaviour. Behaviour reads the settings, never NODE_ENV. A default can go once every
 * deployment sets its variable.
 * @param {string} nodeEnv the value of NODE_ENV
 * @returns {Object<string, string>} each variable's default, as an environment value
 */
const buildNodeEnvDefaults = (nodeEnv) => {
  const isProduction = nodeEnv === 'production';
  return {
    ENVIRONMENT_LABEL: nodeEnv,
    REGISTRAR_VALIDATE_KYB_PROFILE: String(isProduction),
    REGISTRAR_AUTO_ACTIVATE_SERVICES: String(!isProduction),
    REGISTRAR_NETWORK_NAME: getOr('', nodeEnv, registrarNetworkNames),
    REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS: String(!isProduction),
    ENABLE_UNSIGNED_JSON_FORMAT: String(!isProduction),
  };
};

module.exports = {
  buildNodeEnvDefaults,
  nodeEnvDefaults: buildNodeEnvDefaults(
    env.get('NODE_ENV').required().asString(),
  ),
};
