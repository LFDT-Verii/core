const { program } = require('commander');
const { reduce } = require('lodash/fp');
const { printInfo, printError, parseColumn } = require('../helpers');
const { runBatchIssuing } = require('./orchestrators');

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
    'file name containing variables'
  )
  .requiredOption(
    '-o, --offer-template-filename <filename>',
    'file name containing the credential template file'
  )
  .requiredOption(
    '-p, --path <path>',
    'the output directory to use where QR codes and output state files are stored'
  )
  .requiredOption(
    '-t, --terms-url <termsUrl>',
    'the url to the T&Cs that holder must consent to'
  )
  .option(
    '-d, --did <did>',
    'DID of the issuing organization. One of `tenant` or `did` must be specified.'
  )
  .option(
    '-n, --tenant <tenantId>',
    "Id of the issuing organization's tenant. One of `tenant` or `did` must be specified."
  )
  .option(
    '-m, --identifier-match-column <identifierMatchColumn>',
    `the column from the CSV for the user to be matched against the ID credential's "identifier" property
    For example this should be the email column if matching against an Email credential type, or the phone number if 
    matching against a Phone credential type. Accepts header name or index. Default is 0.`,
    parseColumn,
    0
  )
  .option(
    '-u, --vendor-userid-column <vendorUseridColumn>',
    `the column from the CSV that is users id. Value is made available as "vendorUserId" in the offer template. Accepts 
    header name or index. Default is 0.`,
    parseColumn,
    0
  )
  .option(
    '-e, --endpoint <url>',
    'Credential Agent Endpoint to call to execute the issuing'
  )
  .option(
    '-a, --auth-token <url>',
    'Bearer Auth Token to be used on the Agent API'
  )
  .option('-l, --label <label>', 'A label to attach to the documents inserted')
  .option(
    '-v, --var <var...>',
    'A variable that will be injected into the credential template renderer. use name=value'
  )
  .option(
    '-y, --credential-type <idCredentialType>',
    'the credential type used for identifying the user. Default is EmailV1.0.',
    'EmailV1.0'
  )
  .option(
    '--purpose <purpose>',
    'The purpose to display to the user. Use a maximum for 64 chars. Default is "Career Credential Issuing"'
  )
  .option(
    '--authTokenExpiresIn <authTokenExpiresIn>',
    'The number of minutes that the offer will be available for after activation. Default is 365 days.',
    '525600'
  )
  .option('--new', 'Use a new disclosure for batch issuing')
  .option(
    '-i, --disclosure [disclosure]',
    'An existing disclosure to use for the batch issuing'
  )
  .option(
    '--legacy',
    'the target credential agent is running in the "LEGACY" offer type mode. Default is false'
  )
  .option(
    '-x --outputcsv',
    "if passed an output csv is generated including the vendor's user id as the first column and the generated qrcode filename and deeplink"
  )
  .option(
    '--x-name <outputCsvName>',
    'The file name for the output CSV. Default is "output"'
  )
  .option(
    '--dryrun',
    'if passed in then a dry run executes showing how the data will be formatted'
  )
  .action(async () => {
    const options = program.opts();
    // eslint-disable-next-line better-mutation/no-mutation
    options.vars = parseVar(options.var);
    printInfo(options);
    try {
      await runBatchIssuing(options);
    } catch (error) {
      printError('Batch Issuing Script Failure');
      if (error.response) {
        printError({
          error: error.message,
          statusCode: error.response.statusCode,
          errorCode: error.response.errorCode,
          response: error.response.body,
        });
      } else {
        printError(error);
      }
    }
  })
  .parseAsync(process.argv);
