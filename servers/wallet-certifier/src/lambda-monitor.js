const { createEmailSender } = require('./adapters/email-sender');
const { createHubClient } = require('./adapters/hub-client');
const { loadSecrets } = require('./adapters/secret-loader');
const { loadConfig } = require('./config');
const { initMongo } = require('./repositories/mongodb');
const { monitorRuns } = require('./services/monitor-runs');

const createMonitorHandler = (context) => async () => monitorRuns(context);

let runtimeHandler;

const initRuntimeHandler = async () => {
  const config = loadConfig();
  const secrets = await loadSecrets(config);
  const runtimeConfig = { ...config, ...secrets };
  const { repositories } = await initMongo(
    secrets.mongoConnectionString,
    config.databaseName,
  );
  return createMonitorHandler({
    config: runtimeConfig,
    repositories,
    hubClient: createHubClient({
      baseUrl: config.hubUrl,
      operatorToken: secrets.hubOperatorToken,
      tenantId: config.tenantId,
    }),
    sendEmail: createEmailSender(runtimeConfig),
    now: () => new Date(),
  });
};

const handler = async (event, context) => {
  if (!runtimeHandler) {
    // eslint-disable-next-line better-mutation/no-mutation
    runtimeHandler = await initRuntimeHandler();
  }
  return runtimeHandler(event, context);
};

module.exports = { createMonitorHandler, handler };
