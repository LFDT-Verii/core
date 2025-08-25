const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const { csvResponseHook } = require('../src/csv-response-hook');

const buildFastify = () => {
  const fastify = require('fastify')();

  fastify.get(
    '/test-csv',
    {
      onSend: csvResponseHook('test.csv'),
    },
    (_, res) => {
      res.send('test');
    }
  );

  fastify.get(
    '/test-csv-error',
    {
      onSend: csvResponseHook('test.csv'),
    },
    () => {
      throw new Error('test');
    }
  );

  return fastify;
};

describe('csvResponseHook Test Suite', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('should set content-type and content-disposition headers and return 200', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test-csv',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-disposition']).toEqual(
      'attachment; filename=test.csv'
    );
    expect(response.headers['content-type']).toEqual('text/csv');
  });

  it('should not set content-type and content-disposition headers when erroring', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test-csv-error',
    });

    expect(response.statusCode).toEqual(500);
    expect(response.headers['content-disposition']).toBeUndefined();
    expect(response.headers['content-type']).toEqual(
      'application/json; charset=utf-8'
    );
  });
});
