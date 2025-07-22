const { createServer, listenServer } = require('@verii/server-provider');
const { flow } = require('lodash/fp');
const config = require('./config/config');
const { initServer } = require('./init-server');

/* istanbul ignore next */
process.on('unhandledRejection', (error) => {
  console.error(error);
  process.exit(1);
});

flow(createServer, initServer, listenServer)(config);
