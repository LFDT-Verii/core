const { program } = require('commander');
const packageJson = require('../package.json');

program
  .version(packageJson.version, '-v, --vers', 'Current tool version')
  .command('vendorcreds', 'load data from csv to the vendor', {
    executableFile: `${__dirname}/vendor-credentials/index.js`,
  })
  .command('batchissuing', 'issue credentials from csv', {
    executableFile: `${__dirname}/batch-issuing/index.js`,
  })
  .usage('[command] [options]')
  .passThroughOptions()
  .parse(process.argv);
