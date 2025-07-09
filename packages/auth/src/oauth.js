const fp = require('fastify-plugin');
const { isEmpty, some, trim } = require('lodash/fp');
const newError = require('http-errors');
const fastifyAuth0 = require('fastify-auth0-verify');

const ERROR_MESSAGES = {
  MISSING_REQUIRED_SCOPES_TEMPLATE: ({ requiredScopes }) =>
    `User must have one of the following scopes: ${JSON.stringify(
      requiredScopes
    )}`,
};

const initHasMatchingScope = (targetScopes) => (user) => {
  const { scope = '' } = user;
  const userScopes = scope.split(' ');
  return some(
    (userScope) => targetScopes.includes(trim(userScope)),
    userScopes
  );
};

const verifyAccessToken = (requiredScopes = []) => {
  if (isEmpty(requiredScopes)) {
    return (req, reply) => req.server.authenticate(req, reply);
  }

  const hasMatchingScope = initHasMatchingScope(requiredScopes);
  return async (req, reply) => {
    await req.server.authenticate(req, reply);
    if (!hasMatchingScope(req.user)) {
      throw new newError.Forbidden(
        ERROR_MESSAGES.MISSING_REQUIRED_SCOPES_TEMPLATE({ requiredScopes })
      );
    }
  };
};

const oauthPlugin = (fastify, options, next) => {
  fastify
    .register(fastifyAuth0, options)
    .decorate('verifyAccessToken', verifyAccessToken);

  next();
};

const createOauthConfig = (env, { isTest }) => ({
  refreshUrl: env.get('VNF_OAUTH_TOKENS_ENDPOINT').required(!isTest).asString(),
  authorizationUrl: env
    .get('VNF_OAUTH_AUTHORIZATION_ENDPOINT')
    .required(!isTest)
    .asString(),
});

module.exports = {
  initHasMatchingScope,
  oauthPlugin: fp(oauthPlugin, { fastify: '>=2.0.0', name: 'oauth' }),
  createOauthConfig,
};
