const { describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { promisify } = require('../src/promisify');

const reply = {
  code: mock.fn(() => reply),
  send: mock.fn(() => reply),
};

describe('Test promisify method for Fastify plugins', () => {
  it('Should return the same response & request as the original plugin`s function invocation', async () => {
    const request = {};

    const plugin = (req, res, done) => {
      req.user = { id: '123' };
      res.code(200).send({ hello: 'world' });

      done();
    };

    const decoratedPlugin = promisify(plugin);

    await decoratedPlugin(request, reply);

    expect(reply.code.mock.calls.map((call) => call.arguments)).toContainEqual([
      200,
    ]);
    expect(reply.send.mock.calls.map((call) => call.arguments)).toContainEqual([
      { hello: 'world' },
    ]);
    expect(request.user).toEqual({ id: '123' });
  });

  it('should return the same error as the original Fastify plugin function', async () => {
    const request = {};

    const plugin = (req, res, done) => {
      reply.code(401);
      done({ message: 'Unauthorized' });
    };

    const decoratedPlugin = promisify(plugin);

    await expect(decoratedPlugin(request, reply)).rejects.toMatchObject({
      message: 'Unauthorized',
    });

    expect(reply.code.mock.calls.map((call) => call.arguments)).toContainEqual([
      401,
    ]);
  });
});
