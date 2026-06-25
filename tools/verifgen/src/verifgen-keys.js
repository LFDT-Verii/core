const { program } = require('commander');
const { generateKeyPair } = require('@verii/crypto');
const common = require('./common');

const generateKeys = (publicKeyFile, privateKeyFile) => {
  try {
    const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });

    common.writeFile(publicKeyFile, common.stringifyJson(publicKey));
    common.writeFile(privateKeyFile, common.stringifyJson(privateKey));
  } catch (ex) {
    common.printError(ex);
  }
};

program
  .name('verifgen personal keys')
  .description('Generates a public and private key pair')
  .usage('[options]')
  .option(
    '-b, --public-key-file <filename>',
    'Output public key file name',
    'pub.key.json',
  )
  .option(
    '-v, --private-key-file <filename>',
    'Output private key file name',
    'prv.key.json',
  )
  .action(() => {
    const options = program.opts();
    return generateKeys(options.publicKeyFile, options.privateKeyFile);
  })
  .parse(process.argv);
