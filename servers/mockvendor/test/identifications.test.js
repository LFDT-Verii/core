const { reverse, map, flow } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const initIdentificationsFactory = require('./factories/identifications.factory');

describe('identifications endpoints', () => {
  let fastify;
  let persistIdentification;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistIdentification } = initIdentificationsFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('identifications').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('get endpoint', () => {
    it('should handle if there are no identifications', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/identifications',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ identifications: [] });
    });

    it('should retrieve multiple identifications', async () => {
      const records = [];
      records[0] = await persistIdentification();
      records[1] = await persistIdentification();
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/identifications',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        identifications: flow(
          reverse,
          map((record) => {
            return {
              ...record,
              id: record._id,
            };
          })
        )(records),
      });
    });
  });
});
