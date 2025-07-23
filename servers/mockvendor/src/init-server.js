const { initHttpClient } = require('@verii/http-client');
const path = require('path');
const AutoLoad = require('@fastify/autoload');

const initServer = (server) => {
  return server
    .register(AutoLoad, {
      dir: path.join(__dirname, 'controllers'),
      ignorePattern: /controller(\.ts|\.js|\.cjs|\.mjs)$/,
      indexPattern: /.*repo(\.ts|\.js|\.cjs|\.mjs)$/,
    })
    .register(AutoLoad, {
      dir: path.join(__dirname, 'controllers'),
      autoHooks: true,
      cascadeHooks: true,
      indexPattern: /controller(\.ts|\.js|\.cjs|\.mjs)$/,
    })
    .after(() =>
      server
        .decorate(
          'baseAgentFetch',
          initHttpClient({
            ...server.config,
            prefixUrl: server.config.agentUrl,
            cache: server.cache,
          })
        )
        .decorateRequest('agentFetch', null)
        .addHook('preValidation', async (req) => {
          req.agentFetch = server.baseAgentFetch(req);
        })
    );
};

module.exports = { initServer };
