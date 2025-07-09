const { program } = require('commander');
const { reduce } = require('lodash/fp');
const { printInfo, parseColumn } = require('../helpers');
const { executeVendorCredentials } = require('./orchestrator');

const parseVar = reduce((acc, pair) => {
  const [key, value] = pair.split('=');
  acc[key] = value;
  return acc;
}, {});

program
  .name('data-loader vendorcreds')
  .description('Loads data into a db')
  .usage('[options]')
  .requiredOption(
    '-c, --csv-filename <filename>',
    'File name containing variables'
  )
  .requiredOption(
    '-o, --offer-template-filename <filename>',
    'File name containing the credential template file'
  )
  .option(
    '-p, --person-template-filename <filename>',
    'File name containing the credential template file'
  )
  .option(
    '-e, --endpoint <url>',
    'Endpoint to call to upload the people and credentials to'
  )
  .option(
    '-u  --vendor-userid-column <vendorUseridColumn>',
    `the column from the CSV that is users id. Value is made available as "vendorUserId" in the offer template. Accepts 
    header name or index. Default is 0.`,
    parseColumn,
    '0'
  )
  .option('-t, --auth-token <url>', 'Bearer Auth Token to use')
  .option('-l, --label <label>', 'A label to attach to the documents inserted')
  .option('-v, --var <var...>', 'A variable to add. use name=value')
  .action(async () => {
    const options = program.opts();
    // eslint-disable-next-line better-mutation/no-mutation
    options.vars = parseVar(options.var);
    printInfo(options);
    await executeVendorCredentials(options);
  })
  .parseAsync(process.argv);
