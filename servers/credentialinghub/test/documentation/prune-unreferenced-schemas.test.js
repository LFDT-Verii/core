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
  pruneUnreferencedSchemas,
} = require('../../src/documentation/prune-unreferenced-schemas');

describe('pruneUnreferencedSchemas', () => {
  it('retains direct, transitive, and cyclic schema references', () => {
    const securitySchemes = {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    };
    const source = {
      openapi: '3.0.3',
      paths: {
        '/things': {
          get: {
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Direct' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        securitySchemes,
        responses: {
          Shared: { description: 'Preserved response component' },
        },
        schemas: {
          Direct: {
            allOf: [{ $ref: '#/components/schemas/Transitive' }],
          },
          Transitive: {
            properties: {
              cycle: { $ref: '#/components/schemas/Direct' },
            },
          },
          Unused: {
            type: 'string',
          },
        },
      },
    };
    const sourceSnapshot = structuredClone(source);

    const result = pruneUnreferencedSchemas(source);

    expect(result.components.schemas).toEqual({
      Direct: source.components.schemas.Direct,
      Transitive: source.components.schemas.Transitive,
    });
    expect(result.components.schemas.Direct).toBe(
      source.components.schemas.Direct,
    );
    expect(result.components.securitySchemes).toBe(securitySchemes);
    expect(result.components.responses).toBe(source.components.responses);
    expect(source).toEqual(sourceSnapshot);
  });

  it('ignores refs outside components schemas', () => {
    const source = {
      paths: {
        '/things': {
          get: {
            responses: {
              200: { $ref: '#/components/responses/Shared' },
            },
          },
        },
      },
      components: {
        responses: {
          Shared: { description: 'Shared response' },
        },
        schemas: {
          Unused: { type: 'string' },
        },
      },
    };

    const result = pruneUnreferencedSchemas(source);

    expect(result.components.responses).toBe(source.components.responses);
    expect(result.components.schemas).toEqual({});
  });

  it('follows referenced non-schema components to reachable schemas', () => {
    const source = {
      paths: {
        '/things': {
          get: {
            responses: {
              200: { $ref: '#/components/responses/Shared' },
            },
          },
        },
      },
      components: {
        responses: {
          Shared: {
            description: 'Shared response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Reachable' },
              },
            },
          },
          Unused: {
            description: 'Unused response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Unused' },
              },
            },
          },
        },
        schemas: {
          Reachable: { type: 'string' },
          Unused: { type: 'string' },
        },
      },
    };

    const result = pruneUnreferencedSchemas(source);

    expect(result.components.responses).toBe(source.components.responses);
    expect(result.components.schemas).toEqual({
      Reachable: source.components.schemas.Reachable,
    });
  });

  it('accepts documents without component schemas', () => {
    const withoutComponents = { openapi: '3.0.3', paths: {} };
    const withoutSchemas = {
      openapi: '3.0.3',
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    };

    expect(pruneUnreferencedSchemas(withoutComponents)).toEqual(
      withoutComponents,
    );
    expect(pruneUnreferencedSchemas(withoutSchemas)).toEqual(withoutSchemas);
  });
});
