const { program } = require('commander');
const { jwtSignSymmetric } = require('@verii/jwt');
const { printInfo, printError, writeFile } = require('./common');

const generateJWT = async ({ secret, email, groupId }) => {
  const payload = {
    user: email,
    groupId,
  };
  const token = await jwtSignSymmetric(payload, secret);
  return token;
};

program
  .name('verifgen agent-jwt')
  .description('Generate JWTs for agent')
  .usage('[options]')
  .option('-s, --secret <secret>', 'Client Secret')
  .option('-e, --email <email>', 'Client Email')
  .option('-g, --groupId <groupId>', 'Client Group Id')
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
