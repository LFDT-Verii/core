const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('Root routes', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('should respond to /test-integration', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/test-integration',
      payload: { message: 'Hi' },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({ messageReceived: 'Hi' });
  });
});
