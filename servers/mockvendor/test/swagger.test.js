const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('swagger json', () => {
  let fastify;
  before(async () => {
    fastify = buildFastify();
  });

  after(async () => {
    await fastify.close();
  });

  it('should generate json', async () => {
    const result = await fastify.injectJson({
      method: 'GET',
      url: 'documentation/json',
    });
    expect(result.statusCode).toEqual(200);
    expect(result.json).not.toBe(null);
  });
});
