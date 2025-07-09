const { promisify } = require('../src/promisify');

const reply = {
  code: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
};

describe('Test promisify method for Fastify plugins', () => {
  beforeEach(() => {
    reply.code.mockClear();
    reply.send.mockClear();
  });

  it('Should return the same response & request as the original plugin`s function invocation', async () => {
    const request = {};

    const plugin = (req, res, done) => {
      req.user = { id: '123' };
      res.code(200).send({ hello: 'world' });

      done();
    };

    const decoratedPlugin = promisify(plugin);

    await decoratedPlugin(request, reply);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ hello: 'world' });
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

    expect(reply.code).toHaveBeenCalledWith(401);
  });
});
