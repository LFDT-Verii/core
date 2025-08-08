const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('create_did_key controller test suite', () => {
  let fastify;

  before(async () => {
    fastify = await buildFastify({});
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('should return 400 if the request body is invalid', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_did_key',
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
      url: '/api/create_did_key',
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

  it('should create a new P-256 did key', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_did_key',
      payload: {
        crv: 'P-256',
        didMethod: 'did:jwk',
        didKeyId: 'abc1',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({
      keyId: expect.any(String),
      kid: expect.any(String),
      did: expect.any(String),
      publicJwk: {
        crv: 'P-256',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
    });
  });

  it('should create a new secp256k1 did key', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/create_did_key',
      payload: {
        crv: 'secp256k1',
        didMethod: 'did:jwk',
        didKeyId: 'abc1',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({
      keyId: expect.any(String),
      kid: expect.any(String),
      did: expect.any(String),
      publicJwk: {
        crv: 'secp256k1',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
    });
  });
});
