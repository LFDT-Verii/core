const { program } = require('commander');
const { generateDocJwt } = require('@verii/jwt');
const { printInfo, printError, writeFile } = require('./common');

const generateJWT = async ({
  issuer,
  subject,
  audience,
  scope,
  signingKey,
  expiresIn = '30y',
}) => {
  return generateDocJwt({ scope }, signingKey, {
    issuer,
    subject,
    expiresIn,
    audience,
    iat: Math.floor(Date.now() / 1000),
  });
};

program
  .name('verifgen asymmetric-jwt')
  .description('Generate JWTs using asymmetric keys')
  .usage('[options]')
  .requiredOption('-i, --issuer <issuer>', 'Token issuer')
  .requiredOption('-s, --subject <subject>', 'Token subject')
  .requiredOption('-a, --audience <audience>', 'Token audience')
  .requiredOption('-sc, --scope <scope>', 'Token scope')
  .requiredOption('-k, --signingKey <signingKey>', 'Private key for signing')
  .option('-e, --expiresIn <expiresIn>', 'Token expiration time')
  .action(async () => {
    const options = program.opts();

    try {
      printInfo(`options: ${JSON.stringify(options, null, 2)}`);
      const data = await generateJWT(options);
      writeFile(`agent-jwt-${Date.now()}.jwt`, JSON.stringify(data));
      printInfo(data);
    } catch (error) {
      printError(error);
    }
  })
  .parse(process.argv);
