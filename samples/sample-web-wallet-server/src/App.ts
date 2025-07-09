import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import autoload from '@fastify/autoload';
import path from 'path';

const build = (opts: FastifyServerOptions = {}): FastifyInstance => {
  const app = fastify(opts);

  app.register(autoload, {
    dir: path.join(__dirname, 'routes'),
  });

  return app;
};

export default build;
