const { program } = require('commander');
const { printInfo, printError } = require('../helpers/common');
const {
  removePiiFromFinalizedOffers,
} = require('./remove-pii-from-finalized-offers');
const { initMongoClient } = require('../helpers/init-mongo-client');

program
  .name('data-loader agentdb-cli')
  .description('Removes PII from a offers collection')
  .usage('[options]')
  .requiredOption(
    '-u, --mongo-uri <mongoUri>',
    'The url of the mongo database for credential agent'
  )
  .action(async () => {
    const options = program.opts();
    let client;
    printInfo('Starting agentdb-cli script');
    printInfo(options);
    try {
      client = await initMongoClient(options.mongoUri);
      await removePiiFromFinalizedOffers({
        db: client.db(),
      });
    } catch (error) {
      printError('Pii-purge Script Failure');
      printError(error);
    } finally {
      if (client) {
        await client.close();
        printInfo('Pii-purge Script. Mongo client closed');
      }
    }
  })
  .parseAsync(process.argv);
