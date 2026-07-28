const { describe, it } = require('node:test');
const { expect } = require('expect');
const buildFastify = require('../helpers/create-test-fastify');
const { createSwaggerConfig } = require('../../src/config/swagger-config');

const OPERATOR_DOCUMENTATION = {
  operatorSecurityScheme: {
    type: 'oauth2',
    flows: {
      clientCredentials: {
        tokenUrl: '/operator/oauth/token',
        scopes: {},
      },
    },
  },
  securitySchemes: {
    operatorClientBasic: { type: 'http', scheme: 'basic' },
  },
  tags: [{ name: 'Operator Authentication', description: 'M2M auth.' }],
};

const getDocuments = async (operatorDocumentation) => {
  const fastify = buildFastify(
    createSwaggerConfig('1.0.0', operatorDocumentation),
  );

  try {
    const responses = await Promise.all(
      [
        ['operator', '/documentation/json'],
        ['openid4vc', '/documentation/openid4vc.json'],
        ['vnApi', '/documentation/vn-api.json'],
      ].map(async ([name, url]) => {
        const result = await fastify.injectJson({ method: 'GET', url });
        expect(result.statusCode).toEqual(200);
        return [name, result.json];
      }),
    );

    return Object.fromEntries(responses);
  } finally {
    await fastify.close();
  }
};

describe('createSwaggerConfig', () => {
  it('emits static operator authentication with the reserved scheme name', async () => {
    const { operator } = await getDocuments();

    expect(operator.components.securitySchemes).toEqual({
      operatorAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Operator API token',
      },
    });
  });

  it('emits an extension operator scheme in the reserved slot', async () => {
    const { operator } = await getDocuments({
      operatorSecurityScheme: OPERATOR_DOCUMENTATION.operatorSecurityScheme,
    });

    expect(operator.components.securitySchemes).toEqual({
      operatorAuth: OPERATOR_DOCUMENTATION.operatorSecurityScheme,
    });
  });

  it('emits additional operator security schemes', async () => {
    const { operator } = await getDocuments({
      securitySchemes: OPERATOR_DOCUMENTATION.securitySchemes,
    });

    expect(operator.components.securitySchemes).toEqual({
      operatorAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Operator API token',
      },
      operatorClientBasic: { type: 'http', scheme: 'basic' },
    });
  });

  it('prepends extension tags without exposing them to wallet documents', async () => {
    const { operator, openid4vc, vnApi } = await getDocuments(
      OPERATOR_DOCUMENTATION,
    );

    expect(operator.tags.map(({ name }) => name)).toEqual([
      'Operator Authentication',
      'Tenants',
      'Issuer Services',
      'Relying Party Services',
      'Depots',
      'Credentials',
      'Presentations',
      'Issue Links',
      'Presentation Links',
      'Exchanges',
      'Utilities',
    ]);
    expect(openid4vc.components.securitySchemes).toEqual({
      openid4vciAccessToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'OpenID4VCI access token',
      },
    });
    expect(openid4vc.tags.map(({ name }) => name)).toEqual([
      'OpenID4VCI',
      'OpenID4VP',
    ]);
    expect(vnApi.components.securitySchemes).toEqual({
      vnApiAccessToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'VN-API access token',
      },
    });
    expect(vnApi.tags.map(({ name }) => name)).toEqual([
      'Issuing',
      'Presentation',
    ]);
  });

  it('rejects extensions that reuse the reserved operator scheme name', () => {
    expect(() =>
      createSwaggerConfig('1.0.0', {
        securitySchemes: { operatorAuth: { type: 'http', scheme: 'basic' } },
      }),
    ).toThrow();
  });

  it('rejects extensions that reuse an operator tag name', () => {
    expect(() =>
      createSwaggerConfig('1.0.0', {
        tags: [
          { name: 'Operator Authentication', description: 'M2M auth.' },
          { name: 'Operator Authentication', description: 'Duplicate.' },
        ],
      }),
    ).toThrow();
    expect(() =>
      createSwaggerConfig('1.0.0', {
        tags: [{ name: 'Tenants', description: 'Duplicate default tag.' }],
      }),
    ).toThrow();
  });
});
