const { program } = require('commander');
const common = require('./common');

const generateDidFiles = ({ persona, controllerPersona }) => {
  try {
    const controller = controllerPersona
      ? common.loadPersonaFiles(controllerPersona)
      : null;

    const { privateKey, didObject } = common.generateDid(controller);
    const privateKeyFileName = `${persona}.prv.key`;
    const didFileName = `${persona}.did`;

    common.writeFile(privateKeyFileName, privateKey);
    common.writeFile(didFileName, JSON.stringify(didObject, null, 2));
  } catch (ex) {
    common.printError(ex);
  }
};

program
  .name('verifgen did')
  .description('Generates a did with a public key, and a separate private key')
  .usage('[options]')
  .option('-c, --controller-persona <name>', 'Input controller persona', null)
  .option(
    '-p, --persona <name>',
    'Name of the persona that the did is being generated for',
    'self'
  )
  .action(() => generateDidFiles(program.opts()))
  .parse(process.argv);
