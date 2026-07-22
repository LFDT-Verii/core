const { buildServer } = require('./build-server');
const { loadConfig } = require('./config');
const { loadSecrets } = require('./adapters/secret-loader');
const { initMongo } = require('./repositories/mongodb');

const start = async () => {
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
  await server.listen({ host: config.host, port: config.port });
};

start().catch((error) => {
  process.stderr.write(`Wallet Certifier failed to start: ${error.message}\n`);
  // eslint-disable-next-line better-mutation/no-mutation
  process.exitCode = 1;
});
