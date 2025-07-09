const { program } = require('commander');
const packageJson = require('../package.json');

program
  .version(packageJson.version, '-v, --vers', 'Current tool version')
  .command('pii-purge', 'Removes PII from a offers collection', {
    executableFile: `${__dirname}/pii-purge/index.js`,
  })
  .command('rotate-key', 'Re-encrypt MongoDB protected data with new key', {
    executableFile: `${__dirname}/rotate-key/index.js`,
  })
  .command('offers', 'manipulate offers collection', {
    executableFile: `${__dirname}/offers/index.js`,
  })
  .command('metrics', 'get credentials statistic by tenant', {
    executableFile: `${__dirname}/metrics/index.js`,
  })
  .usage('[command] [options]')
  .passThroughOptions()
  .parse(process.argv);
