const { program } = require('commander');

program
  .command('migrate-tenant-did', "migrate a tenant's did", {
    executableFile: `${__dirname}/migrate-tenant-did/index.js`,
  })
  .usage('[command] [options]')
  .passThroughOptions()
  .parse(process.argv);
