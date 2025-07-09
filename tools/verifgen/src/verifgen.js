const { program } = require('commander');
const packageJson = require('../package.json');

program
  .version(packageJson.version, '-v, --vers', 'Current tool version')
  .command('templates', 'View available sample templates', {
    executableFile: `${__dirname}/verifgen-templates.js`,
  })
  .command('keys', 'Generates a public and private key pair', {
    executableFile: `${__dirname}/verifgen-keys.js`,
  })
  .command('address', 'Generates an account address', {
    executableFile: `${__dirname}/verifgen-address.js`,
  })
  .command('credential', 'Generate a verifiable credential', {
    executableFile: `${__dirname}/verifgen-credential.js`,
  })
  .command('presentation', 'Generate a verifiable presentation', {
    executableFile: `${__dirname}/verifgen-presentation.js`,
  })
  .command('verify', 'Verify credential or presentation', {
    executableFile: `${__dirname}/verifgen-verify.js`,
  })
  .command('did', 'Generate a DID', {
    executableFile: `${__dirname}/verifgen-did.js`,
  })
  .command('jwt', 'Generate Signed JWTs for NO Voters', {
    executableFile: `${__dirname}/verifgen-jwt.js`,
  })
  .command('agent-jwt', 'Generate JWTs for agent', {
    executableFile: `${__dirname}/verifgen-agent-jwt-generator.js`,
  })
  .command('asymmetric-jwt', 'Generate JWTs using asymmetric keys', {
    executableFile: `${__dirname}/verifgen-asymmetric-jwt.js`,
  })
  .command('proof', 'Generate a proof', {
    executableFile: `${__dirname}/verifgen-proof/verifgen-proof.js`,
  })
  .usage('[command] [options]')
  .passThroughOptions()
  .parse(process.argv);
