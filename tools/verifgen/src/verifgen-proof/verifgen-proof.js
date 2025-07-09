const { program } = require('commander');
const common = require('../common');
const { generateProof } = require('./generate-proof');

program
  .name('verifgen proof')
  .description('Generate a proof')
  .usage('[options]')
  .option(
    '-c, --challenge <challenge>',
    'Challenge from generate-offers response'
  )
  .option(
    '-r, --response <generate-offers-response-filename>',
    'Generate Offers Response filename',
    'generate-offers-response.json'
  )
  .requiredOption(
    '-a, --audience <audience>',
    'The audience to use when signing the proof'
  )
  .requiredOption(
    '-p, --persona <persona>',
    'The persona that will sign the proof. Must be hex format.'
  )
  .action(() => {
    const options = program.opts();
    common.printInfo('Generating proof');
    common.printInfo(`Options: ${JSON.stringify(options, null, 2)}`);
    return generateProof(options);
  })
  .parse(process.argv);
