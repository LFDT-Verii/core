const { describe, it } = require('node:test');
const { expect } = require('expect');

const fastify = require('fastify');
const {
  responseRequestIdPlugin,
} = require('../src/response-request-id-plugin');

describe('Response request id test suite', () => {
  it('should add requestId field to the response body', async () => {
    const server = fastify({
      genReqId: () => 'fooReqId',
    });
    server.register(responseRequestIdPlugin);
    server.get('/', () => ({ foo: 'bar' }));
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });
    await server.close();
    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({ foo: 'bar', requestId: 'fooReqId' });
  });
});
