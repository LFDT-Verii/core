const { program } = require('commander');
const { printInfo, printError } = require('../helpers/common');
const {
  updateOfferExpirationDates,
} = require('./update-offer-expiration-dates');
const { initMongoClient } = require('../helpers/init-mongo-client');

program
  .name('data-loader agentdb-cli')
  .description('Mass update offer expiration dates on a collection')
  .usage('[options]')
  .requiredOption('-u, --mongo-uri <mongoUri>', 'The url of the mongo database')
  .option('-d, --did [value...]', 'Dids of issuing organizations', [])
  .action(async () => {
    const options = program.opts();
    let client;
    printInfo('Starting agentdb-cli script');
    printInfo(options);
    try {
      client = await initMongoClient(options.mongoUri);
      await updateOfferExpirationDates({
        db: client.db(),
        dids: options.did,
      });
    } catch (error) {
      printError('Offers Script Failure');
      printError(error);
    } finally {
      if (client) {
        await client.close();
        printInfo('Offers Script. Mongo client closed');
      }
    }
  })
  .parseAsync(process.argv);
