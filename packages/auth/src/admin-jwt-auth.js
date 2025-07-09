const { isEqual } = require('lodash/fp');
const fp = require('fastify-plugin');
const fastifyJWT = require('@fastify/jwt');
const newError = require('http-errors');

const ERROR_MESSAGES = {
  TOKEN_NOT_VALID: 'Token not valid',
};

const verifyAdmin = async (req) => {
  try {
    await req.adminUserJwtVerify();
  } catch (e) {
    throw newError.Unauthorized(e);
  }

  if (!isEqual(req?.user?.user, req.server.config?.adminUserName)) {
    throw new newError.Unauthorized(ERROR_MESSAGES.TOKEN_NOT_VALID);
  }
};

const authPlugin = (fastify, options, next) => {
  fastify
    .register(fastifyJWT, {
      secret: fastify.config.secret,
      namespace: 'adminUser',
    })
    .decorate('verifyAdmin', verifyAdmin);

  next();
};

module.exports = {
  adminJwtAuthPlugin: fp(authPlugin, { fastify: '>=2.0.0', name: 'auth' }),
};
