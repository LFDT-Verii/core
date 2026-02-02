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

const { after, before, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const console = require('console');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env: config } = require('@spencejs/spence-config');
const { deletedExtension } = require('../src/deleted-extension');

describe('deleted extension', () => {
  before(async () => {
    await mongoFactoryWrapper('test-deleted-extension', {
      log: console,
      config,
    });
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  it('should build deleted filter', () => {
    const extension = deletedExtension()({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
      extensions: [],
      collection: {
        name: 'foos',
      },
    });
    expect(extension.prepFilter({ foo: 'bar' })).toEqual({
      deletedAt: {
        $exists: false,
      },
      foo: 'bar',
    });
  });

  it('should build deleted filter with custom field name', () => {
    const extension = deletedExtension('abc')({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
      extensions: [],
      collection: {
        name: 'foos',
      },
    });
    expect(extension.prepFilter({ foo: 'bar' })).toEqual({
      abc: {
        $exists: false,
      },
      foo: 'bar',
    });
  });
});
