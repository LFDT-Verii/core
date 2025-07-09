const { program } = require('commander');
const { printInfo, printError } = require('../helpers/common');
const { getMetrics } = require('./get-metrics');
const { initMongoClient } = require('../helpers/init-mongo-client');

program
  .name('data-loader agentdb-cli')
  .description('Get metrics from offers collection')
  .usage('[options]')
  .requiredOption(
    '-u, --mongo-uri <mongoUri>',
    'The url of the mongo database for credential agent'
  )
  .requiredOption(
    '-s, --start <start>',
    'The start date for filter (ISO 8601 Timestamp)'
  )
  .requiredOption(
    '-e, --end <end>',
    'The end date for filter (ISO 8601 Timestamp)'
  )
  .requiredOption(
    '-d, --did <did>',
    'The did of the tenant on credential agent'
  )
  .action(async () => {
    const options = program.opts();
    let client;
    printInfo('Starting agentdb-cli metrics script');
    printInfo(options);
    try {
      client = await initMongoClient(options.mongoUri);
      const start = new Date(options.start);
      const end = new Date(options.end);
      const { total, unique } = await getMetrics(
        { start, end, did: options.did },
        { db: client.db() }
      );
      printInfo('Metrics Script Success:');
      printInfo(`Start Date: ${start.toString()}`);
      printInfo(`End Date: ${end.toString()}`);
      printInfo(`Tenant: ${options.did}`);
      printInfo(`Total Credentials Issued: ${total}`);
      printInfo(`Unique VendorUserIds: ${unique}`);
    } catch (error) {
      printError('Metrics Script Failure');
      printError(error);
    } finally {
      if (client) {
        await client.close();
        printInfo('Metrics Script. Mongo client closed');
      }
    }
  })
  .parseAsync(process.argv);
