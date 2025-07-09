const { program } = require('commander');
const { printInfo, printError } = require('../helpers/common');
const { initMongoClient } = require('../helpers/init-mongo-client');
const { reencrypt } = require('./reencrypt');

program
  .name('agentdb-cli rotate-key')
  .description('Re-encrypt MongoDB protected data with new key')
  .usage('[options]')
  .requiredOption('-o, --old-key <oldKey>', 'Old encryption key')
  .requiredOption('-n, --new-key <newKey>', 'New encryption key')
  .requiredOption(
    '-u, --mongo-uri <mongoUri>',
    'The url of the mongo database for credential agent'
  )
  .option(
    '-c, --collection <collection>',
    'Override the default collection to update'
  )
  .option(
    '-p, --secret-prop <secretProp>',
    'Override the default encrypted property on the collection'
  )
  .option(
    '--dry-run',
    'Attempt re-encryption but not actually update the database'
  )
  .action(async () => {
    const options = program.opts();
    let client;
    printInfo('Starting rotate-key script');
    printInfo(options);
    try {
      client = await initMongoClient(options.mongoUri);
      await reencrypt(
        options.oldKey,
        options.newKey,
        options.collection,
        options.secretProp,
        {
          ...options,
          db: client.db(),
        }
      );
    } catch (error) {
      printError('rotate-key Script Failure');
      printError(error);
    } finally {
      if (client) {
        await client.close();
        printInfo('rotate-key Script. Mongo client closed');
      }
    }
  })
  .parseAsync(process.argv);
