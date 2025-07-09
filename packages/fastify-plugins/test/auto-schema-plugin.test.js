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

const fastify = require('fastify');
const { autoSchemaPlugin } = require('../src/auto-schema-plugin');

describe('Auto Schema Plugin', () => {
  const fakeServer = {
    decorate: jest.fn().mockImplementation((key, value) => {
      fakeServer[key] = value;
    }),
    getSchema: jest.fn().mockReturnValue(true),
    // eslint-disable-next-line no-prototype-builtins
    hasDecorator: (key) => fakeServer.hasOwnProperty(key),
  };

  it('should add 44 decorators', async () => {
    await autoSchemaPlugin(fakeServer);

    expect(fakeServer.decorate.mock.calls[0]).toEqual([
      'BadRequestResponse',
      { 400: { $ref: 'error#' } },
    ]);
    expect(fakeServer.decorate.mock.calls[1]).toEqual([
      'UnauthorizedResponse',
      { 401: { $ref: 'error#' } },
    ]);
    expect(fakeServer.decorate.mock.calls[2]).toEqual([
      'PaymentRequiredResponse',
      { 402: { $ref: 'error#' } },
    ]);
    expect(fakeServer.decorate.mock.calls[3]).toEqual([
      'ForbiddenResponse',
      { 403: { $ref: 'error#' } },
    ]);
    expect(fakeServer.ForbiddenResponse).toEqual({ 403: { $ref: 'error#' } });
    expect(fakeServer.decorate.mock.calls).toHaveLength(44);
    expect(fakeServer.currentAutoSchemaPreset).toEqual(null);
    expect(fakeServer.autoSchemaPreset).toEqual(expect.any(Function));
    expect(fakeServer.autoSchema).toEqual(expect.any(Function));
  });

  it('should fail if no error schema is defined', async () => {
    const fakeServerError = {
      decorate: jest.fn(),
      getSchema: jest.fn().mockReturnValue(undefined),
    };

    await expect(autoSchemaPlugin(fakeServerError)).rejects.toEqual(
      Error('autoSchemaPlugin requires a schema with id "error"')
    );
  });

  it('should add custom error schema', async () => {
    const fakeServerError = {
      decorate: jest.fn().mockImplementation((key, value) => {
        fakeServer[key] = value;
      }),
      getSchema: jest.fn().mockReturnValue(true),
    };

    await autoSchemaPlugin(fakeServerError, { errorSchemaId: 'randomId' });

    expect(fakeServer.UnauthorizedResponse).toEqual({
      401: { $ref: 'randomId#' },
    });
    expect(fakeServer.PaymentRequiredResponse).toEqual({
      402: { $ref: 'randomId#' },
    });
    expect(fakeServer.ForbiddenResponse).toEqual({
      403: { $ref: 'randomId#' },
    });
  });

  it('autoSchema should default error 500 if nothing is set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(fakeServer.autoSchema({})).toEqual({
      response: { '5xx': { $ref: 'error#' } },
    });
  });
  it('autoSchema should add presets if they are set', async () => {
    await autoSchemaPlugin(fakeServer);
    fakeServer.currentAutoSchemaPreset = { preset: 'foobar' };
    expect(fakeServer.autoSchema({})).toEqual({
      preset: 'foobar',
      response: { '5xx': { $ref: 'error#' } },
    });
  });

  it('autoSchema should add 401 & 403 error codes if security is set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(fakeServer.autoSchema({ security: {} })).toEqual({
      security: {},
      response: {
        401: { $ref: 'error#' },
        403: { $ref: 'error#' },
        '5xx': { $ref: 'error#' },
      },
    });
  });
  it('autoSchema should add 401 & 403 error codes if top level security is set', async () => {
    await autoSchemaPlugin(fakeServer, { swagger: { security: {} } });
    expect(fakeServer.autoSchema({})).toEqual({
      response: {
        401: { $ref: 'error#' },
        403: { $ref: 'error#' },
        '5xx': { $ref: 'error#' },
      },
    });
  });
  it('autoSchema should add default error 500 if response 200 is set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(
      fakeServer.autoSchema({ response: { 200: { type: 'string' } } })
    ).toEqual({
      response: { 200: { type: 'string' }, '5xx': { $ref: 'error#' } },
    });
  });
  it('autoSchema should default error 400 & 500 if body is set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(
      fakeServer.autoSchema({
        body: { type: 'string' },
      })
    ).toEqual({
      body: { type: 'string' },
      response: { 400: { $ref: 'error#' }, '5xx': { $ref: 'error#' } },
    });
  });

  it('autoSchema should customize error to 422 if validationErrorCode is set', async () => {
    await autoSchemaPlugin(fakeServer, { validationErrorCode: 422 });
    expect(
      fakeServer.autoSchema({
        body: { type: 'string' },
      })
    ).toEqual({
      body: { type: 'string' },
      response: { 422: { $ref: 'error#' }, '5xx': { $ref: 'error#' } },
    });
  });
  it('autoSchema should default error 404 & 500 if params are set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(
      fakeServer.autoSchema({
        params: { type: 'string' },
      })
    ).toEqual({
      params: { type: 'string' },
      response: { 404: { $ref: 'error#' }, '5xx': { $ref: 'error#' } },
    });
  });

  it('autoSchema should default error 400 & 500 if query is set', async () => {
    await autoSchemaPlugin(fakeServer);
    expect(
      fakeServer.autoSchema({
        query: { type: 'string' },
      })
    ).toEqual({
      query: { type: 'string' },
      response: { 400: { $ref: 'error#' }, '5xx': { $ref: 'error#' } },
    });
  });

  it('should have autoSchemaPreset update currentAutoSchemaPreset', async () => {
    await autoSchemaPlugin(fakeServer);
    const preset = { whatever: '123' };
    fakeServer.autoSchemaPreset(preset);
    expect(fakeServer.currentAutoSchemaPreset).toEqual(preset);
  });

  it('should fail if autoSchemaPreset correctly handle child fastify contexts', async () => {
    const childVal = { foo: '123' };
    const grandchildVal = { bar: 456 };
    const parent = fastify();
    parent
      .addSchema({ $id: 'error' })
      .register(autoSchemaPlugin)
      .register(async (child) => {
        child.autoSchemaPreset(childVal);
        expect(child.currentAutoSchemaPreset).toEqual(childVal);
        child.register(async (grandchild) => {
          grandchild.autoSchemaPreset(grandchildVal);
          expect(grandchild.currentAutoSchemaPreset).toEqual({
            ...grandchildVal,
            ...childVal,
          });
        });
      });
    expect(parent.currentAutoSchemaPreset).toBeUndefined();
    await parent.ready();
    await parent.close();
  });
});
