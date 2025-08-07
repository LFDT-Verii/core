const { program } = require('commander');
const { map, isEmpty } = require('lodash/fp');
const { nanoid } = require('nanoid');
const {
  generatePresentationJwt,
  toJwk,
  publicKeyFromPrivateKey,
} = require('@verii/jwt');
const { mapWithIndex } = require('@verii/common-functions');
const { generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { VeriiProtocolVersions } = require('@verii/vc-checks');

const common = require('./common');

const generatePresentation = async ({
  credentialSources,
  issuerPersona,
  presentationRequestFilename,
  presentationFile,
  vendorOriginContext,
  protocolVersion,
}) => {
  try {
    const credentials = map(
      (credentialSource) =>
        common.readFile(`${credentialSource}`, 'JWT not found'),
      credentialSources
    );

    const presentationRequest = JSON.parse(
      common.readFile(
        `${presentationRequestFilename}`,
        'Presentation Request not found'
      )
    );

    const { issuer, privateKey } = loadIssuerData(issuerPersona);
    const parsedIssuer = getIssuer({ issuer, protocolVersion });
    const payload = createPayload({
      credentials,
      presentationRequest,
      issuer: parsedIssuer,
      vendorOriginContext,
    });
    const generatePresentationJwtFunction =
      protocolVersion < VeriiProtocolVersions.PROTOCOL_VERSION_2
        ? generatePresentationJwt(payload, privateKey)
        : generatePresentationJwt(
            payload,
            issuer.privateKey,
            `${parsedIssuer}#0`
          );
    const presentationJwt = await generatePresentationJwtFunction;

    common.writeFile(`${presentationFile}.jwt`, presentationJwt);
  } catch (ex) {
    common.printError(ex);
  }
};

const createPayload = ({
  credentials,
  presentationRequest,
  issuer,
  vendorOriginContext,
}) => {
  const presentationDefinition =
    presentationRequest?.presentation_request?.presentation_definition ??
    presentationRequest?.issuing_request?.presentation_definition;
  const payload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: nanoid(),
    issuer,
    verifiableCredential: credentials,
    presentation_submission: {
      id: nanoid(),
      definition_id: presentationDefinition.id,
      descriptor_map: mapWithIndex(
        (c, i) => ({
          id: nanoid(),
          path: `$.verifiableCredential[${i}]`,
          format: 'jwt_vc',
        }),
        credentials
      ),
    },
  };
  if (!isEmpty(vendorOriginContext)) {
    payload.vendorOriginContext = vendorOriginContext;
  }
  return payload;
};

const getIssuer = ({ issuer, protocolVersion }) => {
  if (protocolVersion < VeriiProtocolVersions.PROTOCOL_VERSION_2) {
    return issuer == null ? 'https://self-issued.me' : issuer.did.id;
  }

  if (isEmpty(issuer?.privateKey)) {
    throw new Error('Issuer Persona is required');
  }

  const publicKey = publicKeyFromPrivateKey(issuer?.privateKey);
  return getDidUriFromJwk(toJwk(publicKey, false));
};

const loadIssuerData = (issuerPersona) => {
  if (issuerPersona == null) {
    return { privateKey: generateKeyPair({ format: 'jwk' }).privateKey };
  }
  const issuer = common.loadPersonaFiles(issuerPersona);

  const { privateKey } = common.generateDid(issuer);
  return {
    issuer,
    privateKey,
  };
};

program
  .name('verifgen presentation')
  .description('Generate a verifiable presentation')
  .usage('[options]')
  .option('-c, --credential-sources [value...]', 'Credential sources', [])
  .option(
    '-r, --request <presentation-request-filename>',
    'Presentation Request',
    'presentation-request.json'
  )
  .option('-i, --issuer-persona <persona>', 'Issuer Persona')
  .option('-p, --protocol-version <protocolVersion>', 'VNF protocol version', 1)
  .option(
    '-o, --output-presentation-fileprefix <filename>',
    'Output presentation JWT file prefix',
    'presentation'
  )
  .option(
    '-v, --vendor-origin-context <vendor-origin-context>',
    'A preauthorization code or access token'
  )
  .action(() => {
    const options = program.opts();
    return generatePresentation({
      credentialSources: options.credentialSources,
      issuerPersona: options.issuerPersona,
      presentationRequestFilename: options.request,
      presentationFile: options.outputPresentationFileprefix,
      vendorOriginContext: options.vendorOriginContext,
      protocolVersion: options.protocolVersion,
    });
  })
  .parse(process.argv);
