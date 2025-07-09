const { program } = require('commander');
const fs = require('fs');
const { all, find, get, last, map } = require('lodash/fp');
const {
  initDoVerifyCredentialChecks,
  initVerifyIssuerChain,
} = require('@verii/verifiable-credentials');
const { decodePresentationJwt } = require('@verii/jwt');
const { extractVerificationKey } = require('@verii/did-doc');
const console = require('console');
const common = require('./common');

const context = { log: console };

const verifyVcs = async (presentation, issuerChains, credentialDids) => {
  const buildDidChain = () => issuerChains;
  const verifyIssuerChain = initVerifyIssuerChain(
    extractVerificationKey(get('publicKey[0].id', last(issuerChains)))
  );
  const { verifiableCredential } = decodePresentationJwt(presentation);

  return Promise.all(
    map((credential) => {
      const doVerifyCredentialChecks = initDoVerifyCredentialChecks({
        resolveDID: () => find({ id: credential.id }, credentialDids),
        buildDidChain,
        verifyIssuerChain,
      });

      return doVerifyCredentialChecks(credential, context);
    }, verifiableCredential)
  );
};

const verifyPresentation = async (presentation, issuerChains) => {
  const presentationJwtFile = `${presentation}.jwt`;

  const presentationJwt = common.readFile(
    presentationJwtFile,
    'Presentation JWT not found'
  );
  const credentials = await verifyVcs(presentationJwt, issuerChains);

  console.info(
    JSON.stringify(
      map(
        ({ credentialChecks, ...credential }) => ({
          credential,
          credentialChecks,
        }),
        credentials
      )
    )
  );

  if (
    all(
      (credential) => credential.credentialChecks.UNTAMPERED === 'PASS',
      credentials
    )
  ) {
    console.info('Presentation credentials look good');
    process.exit(0);
  } else {
    console.info('Presentation credentials have been tampered with');
    process.exit(1);
  }
};

const verifyCredential = async (credentialSource, issuerChains) => {
  const credentialJwtFile = `${credentialSource}.jwt`;
  const credentialDidFile = `${credentialSource}.did`;

  const credentialDid = fs.existsSync(credentialDidFile)
    ? JSON.parse(common.readFile(credentialDidFile, 'DID not found'))
    : null;

  const credentialJwt = common.readFile(credentialJwtFile, 'JWT not found');

  const { credentialChecks, ...credential } =
    await initDoVerifyCredentialChecks(credentialJwt, {
      log: console,
      buildDidChain: () => issuerChains,
      verifyIssuerChain: initVerifyIssuerChain({
        vnfPublicKeyId: get('publicKey[0].id', last(issuerChains)),
      }),
      resolveCredentialDid: () => credentialDid,
    });

  console.info(JSON.stringify({ credential, credentialChecks }, null, 2));
  if (credentialChecks.UNTAMPERED === 'PASS') {
    console.info('Credential looks good');
    process.exit(0);
  } else {
    console.info('Credential has been tampered with');
    process.exit(1);
  }
};

const verify = async (credentialSource, presentation, issuerPersonas) => {
  try {
    const issuerChains = map(
      (issuerPersona) =>
        JSON.parse(common.readFile(`${issuerPersona}.did`, 'DID not found')),
      issuerPersonas
    );

    if (credentialSource) {
      await verifyCredential(credentialSource, issuerChains);
    } else if (presentation) {
      await verifyPresentation(presentation, issuerChains);
    }
  } catch (ex) {
    common.printError(ex);
  }
};

program
  .name('verifgen verify')
  .description('Verify a credential')
  .usage('[options]')
  .option('-c, --credential-source <source>', 'Credential source')
  .option('-p, --presentation <source>', 'presentation source')
  .option('-i, --issuer-personas [personas...]', 'Issuer personas', ['vnf'])
  .action(() => {
    const options = program.opts();
    return verify(
      options.credentialSource,
      options.presentation,
      options.issuerPersonas
    );
  })
  .parse(process.argv);
