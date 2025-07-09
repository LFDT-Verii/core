const env = require('env-var');
// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
const console = require('console');

const migrationEnv = env.get('MIGRATION_ENV').required(false).asString();
const envDirPath = '.';
const loadEnv = () => {
  const path = `${envDirPath}/.${migrationEnv}.env`;
  console.log(`Loading ${path}`);
  const envResult = dotenv.config({ path });
  if (envResult.error) {
    console.error(envResult.error);
    throw envResult.error;
  }
  console.log(`Loaded ${JSON.stringify(envResult.parsed)}`);
};

if (migrationEnv && process.env.MONGO_URI == null) {
  loadEnv();
}

const config = {
  mongodb: {
    url: env.get('MONGO_URI').required(true).asString(),
    options: {
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
      //   connectTimeoutMS: 3600000, // increase connection timeout to 1 hour
      //   socketTimeoutMS: 3600000, // increase socket timeout to 1 hour
    },
  },

  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  moduleSystem: 'commonjs',
};

module.exports = config;
