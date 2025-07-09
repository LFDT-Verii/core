const { program } = require('commander');
const { printInfo, printError } = require('../helpers/common');
const { migrateTenantDid } = require('./migrate-tenant-did');

program
  .name('vnf-agent-cli migrate-tenant-did')
  .description("migrate a tenant's did")
  .usage('[options]')
  .requiredOption(
    '-e, --endpoint <url>',
    'Credential Agent Endpoint to call to execute the issuing'
  )
  .requiredOption(
    '-a, --auth-token <url>',
    'Bearer Auth Token to be used on the Agent API'
  )
  .option(
    '-d, --did <did>',
    'The did of tenant that should be migrated. Cannot be combined with --all flag'
  )
  .option(
    '--all',
    'Runs did migration for all tenants on agent. Cannot be combined with --did flag'
  )
  .action(async () => {
    const options = program.opts();
    printInfo('Starting migration of tenant did');
    printInfo(options);
    try {
      await migrateTenantDid({
        options,
      });
    } catch (error) {
      printError('migrate-tenant-did script failure');
      printError(error);
    }
  })
  .parseAsync(process.argv);
