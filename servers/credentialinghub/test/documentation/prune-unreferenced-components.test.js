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
  pruneUnreferencedComponents,
} = require('../../src/documentation/prune-unreferenced-components');

const LOCAL_COMPONENT_REFERENCE_PREFIX = '#/components/';

const isUnvisitedObject = (value, seen) =>
  value != null && typeof value === 'object' && !seen.has(value);

const getLocalComponentReference = (value) =>
  typeof value.$ref === 'string' &&
  value.$ref.startsWith(LOCAL_COMPONENT_REFERENCE_PREFIX)
    ? value.$ref
    : null;

const collectLocalComponentReferences = (
  value,
  references = new Set(),
  seen = new WeakSet(),
) => {
  if (!isUnvisitedObject(value, seen)) {
    return references;
  }

  seen.add(value);
  const reference = getLocalComponentReference(value);
  if (reference != null) {
    references.add(reference);
  }

  for (const child of Object.values(value)) {
    collectLocalComponentReferences(child, references, seen);
  }

  return references;
};

const resolveLocalReference = (document, reference) =>
  reference
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, token) => value?.[token], document);

const expectAllLocalComponentReferencesToResolve = (document) => {
  for (const reference of collectLocalComponentReferences(document)) {
    expect(resolveLocalReference(document, reference)).toBeDefined();
  }
};

describe('pruneUnreferencedComponents', () => {
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

    const result = pruneUnreferencedComponents(source);

    expect(result.components.schemas).toEqual({
      Direct: source.components.schemas.Direct,
      Transitive: source.components.schemas.Transitive,
    });
    expect(result.components.schemas.Direct).toBe(
      source.components.schemas.Direct,
    );
    expect(result.components.securitySchemes).toBe(securitySchemes);
    expect(result.components.responses).toEqual({});
    expect(source).toEqual(sourceSnapshot);
  });

  it('retains non-schema components referenced from paths', () => {
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

    const result = pruneUnreferencedComponents(source);

    expect(result.components.responses).toEqual({
      Shared: source.components.responses.Shared,
    });
    expect(result.components.schemas).toEqual({});
  });

  it('prunes the component graph to transitive and cyclic path references', () => {
    const securitySchemes = {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    };
    const componentExtension = { audience: 'test' };
    const source = {
      paths: {
        '/things': {
          get: {
            security: [{ bearerAuth: [] }],
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
            headers: {
              requestId: { $ref: '#/components/headers/RequestId' },
            },
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
        headers: {
          RequestId: {
            schema: { type: 'string' },
            'x-cycle': { $ref: '#/components/responses/Shared' },
          },
          Unused: {
            schema: { type: 'string' },
          },
        },
        schemas: {
          Reachable: {
            allOf: [{ $ref: '#/components/schemas/Transitive' }],
          },
          Transitive: {
            properties: {
              cycle: { $ref: '#/components/schemas/Reachable' },
            },
          },
          Unused: { type: 'string' },
        },
        securitySchemes,
        'x-audience': componentExtension,
      },
    };
    const sourceSnapshot = structuredClone(source);

    const result = pruneUnreferencedComponents(source);

    expect(result.components.responses).toEqual({
      Shared: source.components.responses.Shared,
    });
    expect(result.components.headers).toEqual({
      RequestId: source.components.headers.RequestId,
    });
    expect(result.components.schemas).toEqual({
      Reachable: source.components.schemas.Reachable,
      Transitive: source.components.schemas.Transitive,
    });
    expect(result.components.securitySchemes).toBe(securitySchemes);
    expect(result.components['x-audience']).toBe(componentExtension);
    expectAllLocalComponentReferencesToResolve(result);
    expect(source).toEqual(sourceSnapshot);
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

    expect(pruneUnreferencedComponents(withoutComponents)).toEqual(
      withoutComponents,
    );
    expect(pruneUnreferencedComponents(withoutSchemas)).toEqual(withoutSchemas);
  });
});
