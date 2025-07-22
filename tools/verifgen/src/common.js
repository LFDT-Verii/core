const console = require('console');
const chalk = require('chalk');
const fs = require('fs');
const { default: bs58 } = require('bs58');
const path = require('path');
const { getOr } = require('lodash/fp');
const { generateKeyPair } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { generateProof } = require('@verii/did-doc');

const templatesPath = path.resolve(__dirname, '../templates');

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

const printError = (ex) => console.error(ex);
const printInfo = (data) => console.info(data);

const generateDid = (controller = {}) => {
  const { privateKey, publicKey } = generateKeyPair();
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
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyBase58: bs58.encode(Buffer.from(publicKey, 'hex')),
      },
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  didObject.proof = generateProof(
    didObject,
    proofController,
    proofSigningKey,
    `${proofController}#key-1`
  );

  return { privateKey, publicKey, address, did, didObject };
};

const loadPersonaFiles = (persona) => {
  return {
    did: JSON.parse(
      readFile(`${persona}.did`, `Persona ${persona} DID File not found`)
    ),
    privateKey: loadPersonaPrivateKey(persona),
  };
};

const loadPersonaPrivateKey = (persona) => {
  const missingErrorMessage = `Persona ${persona}  private key file not found`;
  const jwkFilePath = `${persona}.prv.key.json`;
  const filePath = `${persona}.prv.key`;
  if (fs.existsSync(jwkFilePath)) {
    const jsonStr = readFile(jwkFilePath, missingErrorMessage);
    return JSON.parse(jsonStr);
  }
  return readFile(filePath, missingErrorMessage);
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
};
