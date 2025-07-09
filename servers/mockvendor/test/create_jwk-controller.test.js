const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('create_jwk controller test suite', () => {
  let fastify;

  beforeAll(async () => {
    fastify = await buildFastify({});
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return 400 if the request body is invalid', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_jwk',
      payload: {},
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json).toStrictEqual({
      code: 'FST_ERR_VALIDATION',
      message: "body must have required property 'crv'",
      statusCode: 400,
      error: 'Bad Request',
    });
  });

  it('should return 400 if the crv is invalid', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_jwk',
      payload: {
        crv: 'abc',
      },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json).toStrictEqual({
      code: 'FST_ERR_VALIDATION',
      message: 'body/crv must be equal to one of the allowed values',
      statusCode: 400,
      error: 'Bad Request',
    });
  });

  it('should create a new jwk', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_jwk',
      payload: {
        crv: 'P-256',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({
      keyId: expect.any(String),
      jwk: {
        crv: 'P-256',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
    });
  });

  it('should create a new jwk', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_jwk',
      payload: {
        crv: 'secp256k1',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({
      keyId: expect.any(String),
      jwk: {
        crv: 'secp256k1',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
    });
  });
});
