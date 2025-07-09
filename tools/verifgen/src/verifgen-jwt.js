const { program } = require('commander');
const got = require('got');
const { printInfo, printError, writeFile } = require('./common');

const environments = {
  dev: 'https://devauth.velocitynetwork.foundation/oauth/token',
  staging: 'https://stagingauth.velocitynetwork.foundation/oauth/token',
  prod: 'https://auth.velocitynetwork.foundation/oauth/token',
};

const generateJwt = async ({ clientId, clientSecret, environment }) => {
  const url = environments[environment];
  return got
    .post(url, {
      headers: { 'content-type': 'application/json' },
      json: {
        grant_type: 'client_credentials',
        audience: 'https://velocitynetwork.node',
        client_id: clientId,
        client_secret: clientSecret,
      },
    })
    .json();
};

program
  .name('verifgen jwt')
  .description('Generate JWT')
  .usage('[options]')
  .option('-ci, --client-id <id>', 'Client id')
  .option('-cs, --client-secret <secret>', 'Client secret')
  .option('-e, --environment <environment>', 'Auth0 environment')
  .action(async () => {
    const options = program.opts();
    try {
      const data = await generateJwt(options);
      writeFile(`node-operator-${Date.now()}.jwt`, JSON.stringify(data));
      printInfo(data);
    } catch (error) {
      printError(error);
    }
  })
  .parse(process.argv);
