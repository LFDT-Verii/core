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

const { afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv();

const { forEach } = require('lodash/fp');
const veriiConfig = require('@verii/config');

const configModules = [
  require.resolve('../../src/config/core-config'),
  require.resolve('../../src/config/holder-config'),
];

const clearConfigModules = () =>
  forEach((configModule) => {
    delete require.cache[configModule];
  }, configModules);

// Loads the holder config as a server with this NODE_ENV would
const loadHolderConfigUnder = (nodeEnv) => {
  const configMock = mock.module('@verii/config', {
    namedExports: {
      ...veriiConfig,
      genericConfig: {
        ...veriiConfig.genericConfig,
        nodeEnv,
        isProd: nodeEnv === 'production',
      },
    },
  });
  clearConfigModules();
  try {
    return require('../../src/config/holder-config').holderConfig;
  } finally {
    configMock.restore();
    clearConfigModules();
  }
};

describe('Holder config', () => {
  afterEach(() => {
    delete process.env.ENABLE_UNSIGNED_JSON_FORMAT;
  });

  it('should allow unsigned json format by default unless NODE_ENV is production', () => {
    expect(loadHolderConfigUnder('dev').enableUnsignedJsonFormat).toEqual(true);
    expect(loadHolderConfigUnder('staging').enableUnsignedJsonFormat).toEqual(
      true,
    );
    expect(
      loadHolderConfigUnder('production').enableUnsignedJsonFormat,
    ).toEqual(false);
  });

  it('should prefer ENABLE_UNSIGNED_JSON_FORMAT to its NODE_ENV default', () => {
    process.env.ENABLE_UNSIGNED_JSON_FORMAT = 'true';
    expect(
      loadHolderConfigUnder('production').enableUnsignedJsonFormat,
    ).toEqual(true);
    process.env.ENABLE_UNSIGNED_JSON_FORMAT = 'false';
    expect(loadHolderConfigUnder('dev').enableUnsignedJsonFormat).toEqual(
      false,
    );
  });
});
