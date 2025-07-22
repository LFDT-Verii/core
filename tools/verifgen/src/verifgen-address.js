const { program } = require('commander');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const common = require('./common');

const generateAddress = (publicKeyFile, addressFile) => {
  try {
    const publicKey = common.readFile(publicKeyFile, 'Public key not found');
    const address = toEthereumAddress(publicKey);

    common.writeFile(addressFile, address);
  } catch (ex) {
    common.printError(ex);
  }
};

program
  .name('verifgen address')
  .description('Generates an account address')
  .usage('[options]')
  .option(
    '-b, --public-key-file <filename>',
    'Input public key file name',
    'pub.key'
  )
  .option(
    '-a, --address-file <filename>',
    'Output account address file name',
    'account.address'
  )
  .action(() => {
    const options = program.opts();
    return generateAddress(options.publicKeyFile, options.addressFile);
  })
  .parse(process.argv);
