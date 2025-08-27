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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv();
const Fastify = require('fastify');
const Ajv = require('ajv');
const { initValidation, wrapValidationError, validationPlugin } = require('..');

const schema = {
  $id: 'hello-schema',
  type: 'object',
  properties: {
    hello: { type: 'string' },
  },
};

const expectedValidationError = {
  instancePath: '/hello',
  keyword: 'type',
  message: 'must be string',
  params: {
    type: 'string',
  },
  schemaPath: '#/properties/hello/type',
};

describe('validation package', () => {
  describe('wrapValidationError', () => {
    it('should format an error properly if dataVar empty', () => {
      const result = wrapValidationError([expectedValidationError]);
      expect(result).toEqual(new Error('/hello must be string'));
    });
    it('should format an error properly', () => {
      const result = wrapValidationError([expectedValidationError], '$');
      expect(result).toEqual(new Error('$/hello must be string'));
    });
  });

  describe('addDocSchema Test Suite', () => {
    let addDocSchema;
    let hasDocSchema;

    beforeEach(() => {
      ({ addDocSchema, hasDocSchema } = initValidation(new Ajv()));
    });

    it('should add a schema', () => {
      addDocSchema(schema);
      expect(hasDocSchema(schema.$id)).toEqual(true);
    });

    it('should fail to add a schema if it already exists by default', () => {
      addDocSchema(schema);
      const func = () => addDocSchema(schema);
      expect(func).toThrow(
        'schema with key or id "hello-schema" already exists'
      );
    });
    it('should add a schema even if it already exists if override is set to true', () => {
      addDocSchema(schema);
      addDocSchema(schema, true);
      expect(hasDocSchema(schema.$id)).toEqual(true);
    });

    it('should throw other errors properly when override is set', (t) => {
      const mockAjvAddSchema = t.mock.fn(() => {
        throw new Error('foo error');
      });
      ({ addDocSchema, hasDocSchema } = initValidation({
        addSchema: mockAjvAddSchema,
      }));
      const func = () => addDocSchema(schema, true);
      expect(func).toThrow('foo error');
    });
  });
  describe('hasDocSchema', () => {
    const { addDocSchema, hasDocSchema } = initValidation(new Ajv());
    before(() => {
      addDocSchema(schema);
    });

    it('should has loaded schema', () => {
      expect(hasDocSchema(schema.$id)).toEqual(true);
    });

    it('should fail incorrect docs', () => {
      expect(hasDocSchema('DOESNT_EXIST')).toEqual(false);
    });
  });

  describe('getDocSchema', () => {
    const { addDocSchema, getDocValidator } = initValidation(new Ajv());
    before(() => {
      addDocSchema(schema);
    });

    it('should has loaded schema', () => {
      expect(getDocValidator(schema.$id)).toEqual(expect.any(Function));
    });

    it('should fail incorrect docs', () => {
      expect(getDocValidator('DOESNT_EXIST')).toBeUndefined();
    });
  });

  describe('removeDocSchema', () => {
    const { addDocSchema, getDocValidator, removeDocSchema } = initValidation(
      new Ajv()
    );

    it('removeDocSchema should remove previously added schema', () => {
      addDocSchema(schema);
      expect(getDocValidator(schema.$id)).toEqual(expect.any(Function));
      removeDocSchema(schema.$id);
      expect(getDocValidator(schema.$id)).toBeUndefined();
    });

    it('should handle not existent schema $id', () => {
      removeDocSchema(schema.$id);
      expect(getDocValidator(schema.$id)).toBeUndefined();
    });

    it('should remove all schemas if no arguments are passed', () => {
      addDocSchema(schema);
      const schema2 = {
        ...schema,
        $id: 'hello-schema-2',
      };
      addDocSchema(schema2);
      removeDocSchema();
      expect(getDocValidator(schema.$id)).toBeUndefined();
      expect(getDocValidator(schema2.$id)).toBeUndefined();
    });
  });
  describe('validateDoc', () => {
    const { addDocSchema, validateDoc } = initValidation(new Ajv());
    before(() => {
      addDocSchema(schema);
    });

    it('should passes correct doc', () => {
      expect(validateDoc({ hello: 'fred' }, schema.$id)).toEqual(false);
    });

    it('should fail incorrect docs', () => {
      expect(validateDoc({ hello: 1 }, schema.$id)).toEqual([
        expectedValidationError,
      ]);
    });
  });
  describe('validation plugin', () => {
    let fastify;

    after(async () => {
      await fastify.close();
    });
    it('should register the validation plugin', async () => {
      fastify = Fastify();
      fastify.decorate('config', {});
      fastify.register(validationPlugin, { decorateRequest: ['addDocSchema'] });

      await fastify.ready();
      expect(fastify.addDocSchema).toEqual(expect.any(Function));
      expect(fastify.getDocValidator).toEqual(expect.any(Function));
      expect(fastify.hasDocSchema).toEqual(expect.any(Function));
      expect(fastify.validateDoc).toEqual(expect.any(Function));
    });
  });

  describe('errorsText', () => {
    const { errorsText } = initValidation(new Ajv());

    it('should show an error text', () => {
      expect(errorsText([expectedValidationError])).toEqual(
        'data/hello must be string'
      );
    });
  });

  describe('validateSchema', () => {
    const { validateSchema } = initValidation(new Ajv());

    it('should return isValid true for a valid schema', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const result = validateSchema(mockSchema);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return isValid false and an error message for an invalid schema', () => {
      const mockSchema = [];
      const result = validateSchema(mockSchema);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('must be object,boolean');
    });
  });

  describe('validateJSONBySchema', () => {
    const { validateJSONBySchema } = initValidation(new Ajv());

    it('should return isValid true for a valid JSON', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const json = { name: 'John', age: 30 };
      const result = validateJSONBySchema(json, mockSchema);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return isValid false and an error message for an invalid JSON', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const json = { name: 'John', age: '30' };
      const result = validateJSONBySchema(json, mockSchema);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('must be number');
    });

    it('should return isValid false and an error message for an invalid schema', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const json = { name: 'John', age: 30 };
      const invalidSchema = {
        type: 'array',
        items: mockSchema,
      };
      const result = validateJSONBySchema(json, invalidSchema);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('must be array');
    });

    it('should return isValid false and an error message for an invalid JSON and schema', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const json = { name: 'John', age: '30' };
      const invalidSchema = {
        type: 'array',
        items: mockSchema,
      };
      const result = validateJSONBySchema(json, invalidSchema);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('must be array');
    });

    it('should return isValid false and an error message for an invalid JSON and a schema with an error', () => {
      const mockSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      const json = { name: 'John' };
      const result = validateJSONBySchema(json, mockSchema);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("must have required property 'age'");
    });
  });
});
