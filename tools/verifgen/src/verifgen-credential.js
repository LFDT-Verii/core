const console = require('console');
const { program } = require('commander');
const { generateCredentialJwt } = require('@verii/jwt');
const common = require('./common');

const doGenerateJwt = async (selfsign, issuer, credentialType, credential) => {
  const { didObject: credentialDid, privateKey: credentialPrivateKey } =
    common.generateDid(issuer);

  const payload = createPayload(
    credential,
    credentialType,
    issuer.did.id,
    credentialDid.id,
  );

  if (selfsign) {
    console.info(`Generating self signed ${credentialType} credential`);
    return {
      jwt: await generateCredentialJwt(payload, credentialPrivateKey),
    };
  }

  console.info(`Generating ${credentialType} credential`);
  return {
    jwt: await generateCredentialJwt(
      payload,
      credentialPrivateKey,
      `${credentialDid.id}#key-1`,
    ),
    credentialDid,
  };
};

const writeFiles = (outputPrefix, { jwt, credentialDid }) => {
  const jwtFile = `${outputPrefix}.jwt`;
  const didFile = `${outputPrefix}.did`;

  common.writeFile(jwtFile, jwt);
  if (credentialDid) {
    common.writeFile(didFile, JSON.stringify(credentialDid, null, 2));
  }
};

const isFilePath = (str) =>
  str.startsWith('./') || str.startsWith('../') || str.startsWith('/');

const loadCredentialSource = (sourceTemplateOrFile) => {
  return isFilePath(sourceTemplateOrFile)
    ? sourceTemplateOrFile
    : common.resolveTemplate(sourceTemplateOrFile);
};

const generateCredential = async (
  sourceTemplate,
  selfsign,
  issuerPersona,
  credentialType,
  outputPrefix,
) => {
  const issuerPrefix = issuerPersona || (selfsign ? 'self' : 'issuer');

  try {
    const issuer = common.loadPersonaFiles(issuerPrefix);
    const credential = JSON.parse(
      common.readFile(
        loadCredentialSource(sourceTemplate),
        'Source template not found',
      ),
    );

    const result = await doGenerateJwt(
      selfsign,
      issuer,
      credentialType,
      credential,
    );

    writeFiles(outputPrefix, result);
  } catch (ex) {
    common.printError(ex);
  }
};

const createPayload = (credential, credentialType, issuer, did) => {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: did,
    type: [credentialType, 'VerifiableCredential'],
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: credential,
  };
};

program
  .name('verifgen credential')
  .description('Generate a verifiable credential')
  .usage('[source-template] [options]')
  .arguments('[source-template]')
  .option('-s, --self-sign', 'Self sign?')
  .option('-i, --issuer-persona <filename>', 'Issuer Persona')
  .option('-t, --credential-type <type>', 'Credential type', 'IdentityDocument')
  .option(
    '-o, --output-prefix <filename>',
    'Output credential file prefix',
    'credential',
  )
  .action((sourceTemplate) => {
    const options = program.opts();
    return generateCredential(
      sourceTemplate,
      options.selfSign,
      options.issuerPersona,
      options.credentialType,
      options.outputPrefix,
    );
  })
  .parse(process.argv);
