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

// eslint-disable-next-line import/order
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const console = require('console');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env: config } = require('@spencejs/spence-config');
const { nanoid } = require('nanoid');
const { multitenantExtension } = require('../src/multitenant-extension');

describe('multitenant extension', () => {
  let tenant1;

  before(async () => {
    await mongoFactoryWrapper('test-multitenant-extension', {
      log: console,
      config,
    });
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  beforeEach(async () => {
    tenant1 = { _id: '123', name: 'ACME' };
  });

  it('should error if tenant missing on the context', () => {
    const extension = multitenantExtension()(
      {
        prepFilter: mock.fn((x) => x),
        prepModification: mock.fn((x) => x),
        extensions: [],
        collection: {
          tableName: 'foos',
        },
      },
      {}
    );
    const funcPrepFilter = () => extension.prepFilter({ foo: 'bar' });
    expect(funcPrepFilter).toThrow('context.tenant[_id] is undefined');
    const funcPrepModification = () =>
      extension.prepModification({ foo: 'bar' });
    expect(funcPrepModification).toThrow('context.tenant[_id] is undefined');
  });

  it('should be ok if the tenantId is already on filter or modification', () => {
    const tenantId = nanoid();

    const extension = multitenantExtension()({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
      extensions: [],
      collection: {
        name: 'foos',
      },
    });

    expect(extension.extensions).toEqual(['multitenantExtension']);
    expect(extension.prepModification({ foo: 'bar', tenantId })).toEqual({
      foo: 'bar',
      tenantId,
    });
    expect(extension.prepFilter({ foo: 'bar', tenantId })).toEqual({
      foo: 'bar',
      tenantId,
    });
  });

  it('should build ok if the tenant is passed', () => {
    const extension = multitenantExtension()(
      {
        prepFilter: mock.fn((x) => x),
        prepModification: mock.fn((x) => x),
        extensions: [],
        collection: {
          name: 'foos',
        },
      },
      { tenant: tenant1 }
    );
    expect(extension.extensions).toEqual(['multitenantExtension']);
    expect(extension.prepModification({ foo: 'bar' })).toEqual({
      foo: 'bar',
      tenantId: tenant1._id,
    });
    expect(extension.prepFilter({ foo: 'bar' })).toEqual({
      foo: 'bar',
      tenantId: tenant1._id,
    });
  });

  it('custom props can be used for multitenant', () => {
    const extension = multitenantExtension({
      repoProp: 'vendor_name',
      tenantProp: 'name',
    })(
      {
        prepFilter: mock.fn((x) => x),
        prepModification: mock.fn((x) => x),
        extensions: [],
        collection: {
          name: 'foos',
        },
      },
      { tenant: tenant1 }
    );
    expect(extension.extensions).toEqual(['multitenantExtension']);
    expect(extension.prepModification({ foo: 'bar' })).toEqual({
      foo: 'bar',
      vendor_name: tenant1.name,
    });
    expect(extension.prepFilter({ foo: 'bar' })).toEqual({
      foo: 'bar',
      vendor_name: tenant1.name,
    });
  });

  it('multitenant value can be migrated on the fly', () => {
    const extension = multitenantExtension({
      migrateFrom: {
        repoProp: 'vendor_name',
        tenantProp: 'name',
      },
    })(
      {
        prepFilter: mock.fn((x) => x),
        prepModification: mock.fn((x) => x),
        extensions: [],
        collection: {
          name: 'foos',
        },
      },
      { tenant: tenant1 }
    );
    expect(extension.extensions).toEqual(['multitenantExtension']);
    expect(extension.prepModification({ foo: 'bar' })).toEqual({
      foo: 'bar',
      tenantId: tenant1._id,
    });
    expect(extension.prepFilter({ foo: 'bar' })).toEqual({
      foo: 'bar',
      $or: [{ tenantId: tenant1._id }, { vendor_name: tenant1.name }],
    });
  });
});
