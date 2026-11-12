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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  buildNodeEnvDefaults,
  nodeEnvDefaults,
} = require('../src/node-env-defaults');
const { nodeEnvDefaults: exportedDefaults } = require('..');

describe('NODE_ENV defaults', () => {
  it('should give production behaviour under production', () => {
    expect(buildNodeEnvDefaults('production')).toEqual({
      ENVIRONMENT_LABEL: 'production',
      REGISTRAR_VALIDATE_KYB_PROFILE: 'true',
      REGISTRAR_AUTO_ACTIVATE_SERVICES: 'false',
      REGISTRAR_NETWORK_NAME: 'MainNet',
      REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS: 'false',
      ENABLE_UNSIGNED_JSON_FORMAT: 'false',
    });
  });

  it('should give the behaviour NODE_ENV gave each other deployment', () => {
    const nonProductionDefaults = (nodeEnv, networkName) => ({
      ENVIRONMENT_LABEL: nodeEnv,
      REGISTRAR_VALIDATE_KYB_PROFILE: 'false',
      REGISTRAR_AUTO_ACTIVATE_SERVICES: 'true',
      REGISTRAR_NETWORK_NAME: networkName,
      REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS: 'true',
      ENABLE_UNSIGNED_JSON_FORMAT: 'true',
    });
    expect(buildNodeEnvDefaults('staging')).toEqual(
      nonProductionDefaults('staging', 'TestNet'),
    );
    expect(buildNodeEnvDefaults('dev')).toEqual(
      nonProductionDefaults('dev', 'DevNet'),
    );
    expect(buildNodeEnvDefaults('development')).toEqual(
      nonProductionDefaults('development', 'LocalDevNet'),
    );
    expect(buildNodeEnvDefaults('test')).toEqual(
      nonProductionDefaults('test', 'LocalDevNet'),
    );
    expect(buildNodeEnvDefaults('localdev')).toEqual(
      nonProductionDefaults('localdev', ''),
    );
  });

  it('should export the defaults for the current NODE_ENV', () => {
    expect(nodeEnvDefaults).toEqual(buildNodeEnvDefaults('test'));
    expect(exportedDefaults).toBe(nodeEnvDefaults);
  });
});
