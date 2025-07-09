const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('swagger json', () => {
  let fastify;
  beforeAll(async () => {
    fastify = buildFastify();
  });

  afterAll(async () => {
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
