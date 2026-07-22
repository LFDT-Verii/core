const awsLambdaFastify = require('@fastify/aws-lambda');
const { buildServer } = require('./build-server');
const { loadConfig } = require('./config');
const { loadSecrets } = require('./adapters/secret-loader');
const { initMongo } = require('./repositories/mongodb');

let proxy;

const getProxy = async () => {
  if (!proxy) {
    const config = loadConfig();
    const secrets = await loadSecrets(config);
    const { repositories } = await initMongo(
      secrets.mongoConnectionString,
      config.databaseName,
    );
    const server = await buildServer({
      config: { ...config, ...secrets },
      repositories,
    });
    // eslint-disable-next-line better-mutation/no-mutation
    proxy = awsLambdaFastify(server);
  }
  return proxy;
};

const handler = async (event, context) => {
  const lambdaProxy = await getProxy();
  return lambdaProxy(event, context);
};

module.exports = { handler };
