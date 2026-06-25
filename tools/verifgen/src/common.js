const console = require('console');
const chalkModule = require('chalk');
const fs = require('fs');
const path = require('path');
const { getOr } = require('lodash/fp');
const { generateKeyPair } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { generateProof } = require('@verii/did-doc');

const templatesPath = path.resolve(__dirname, '../templates');
const dataPath = path.resolve(__dirname, '../data');
const chalk = chalkModule.default ?? chalkModule;

const writeFile = (filePath, fileContent) => {
  const fileBasename = path.basename(filePath, '.*');

  console.info(`${chalk.green('Writing:')} ${chalk.whiteBright(fileBasename)}`);

  fs.writeFileSync(filePath, fileContent, 'utf8');
};

const readFile = (filePath, missingError) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(missingError);
  }

  return fs.readFileSync(filePath, 'utf8');
};

const resolveTemplate = (template) =>
  path.resolve(templatesPath, `${template}.json`);

const resolveDataPath = (filePath) => path.resolve(dataPath, filePath);

const resolveInputPath = (filePath) => {
  if (fs.existsSync(filePath) || path.isAbsolute(filePath)) {
    return filePath;
  }

  return resolveDataPath(filePath);
};

const printError = (ex) => console.error(ex);
const printInfo = (data) => console.info(data);
const stringifyJson = (value) => JSON.stringify(value, null, 2);

const generateDid = (controller = {}) => {
  const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
  const address = toEthereumAddress(publicKey);
  const did = `did:velocity:${address}`;
  const proofSigningKey = getOr(privateKey, 'privateKey', controller);
  const proofController = getOr(did, 'did.id', controller);
  const didObject = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/v1',
    ],
    id: did,
    publicKey: [
      {
        id: `${did}#key-1`,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk: publicKey,
      },
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  didObject.proof = generateProof(
    didObject,
    proofSigningKey,
    `${proofController}#key-1`,
  );

  return { privateKey, publicKey, address, did, didObject };
};

const loadPersonaFiles = (persona) => {
  return {
    did: JSON.parse(
      readFile(
        resolveInputPath(`${persona}.did`),
        `Persona ${persona} DID File not found`,
      ),
    ),
    privateKey: loadPersonaPrivateKey(persona),
  };
};

const loadPersonaPrivateKey = (persona) => {
  const missingErrorMessage = `Persona ${persona}  private key file not found`;
  const jwkFilePath = resolveInputPath(`${persona}.prv.key.json`);
  const jsonStr = readFile(jwkFilePath, missingErrorMessage);
  return JSON.parse(jsonStr);
};

module.exports = {
  printInfo,
  templatesPath,
  writeFile,
  readFile,
  resolveTemplate,
  printError,
  generateDid,
  loadPersonaFiles,
  dataPath,
  resolveDataPath,
  resolveInputPath,
  stringifyJson,
};
