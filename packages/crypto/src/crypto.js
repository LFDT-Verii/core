/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const EC = require('elliptic').ec;
const crypto = require('crypto');
const argon2 = require('argon2');
const { flow, isString, omit } = require('lodash/fp');
const randomNumber = require('random-number-csprng');
const keyto = require('@trust/keyto');
const { HEX_FORMAT } = require('@verii/test-regexes');
const { KeyAlgorithms } = require('./constants');

const secp256k1 = new EC('secp256k1');

const generateRandomBytes = (byteLength) => crypto.randomBytes(byteLength);

const generatePositive256BitHexString = () =>
  `0x${crypto.randomBytes(32).toString('hex')}`;

const createCommitment = (val) => {
  const hash = calculateDigest('sha256')(val);
  const multihashBuffer = Buffer.concat([
    Buffer.from([0x12]), // sha256 code
    Buffer.from(hash.length.toString(16), 'hex'), // digest length
    hash,
  ]);
  return multihashBuffer.toString('base64');
};

const generateJWAKeyPair = (dsaOrConfig) => {
  const jwaConfig = isString(dsaOrConfig)
    ? dsaJwaConfigMap[dsaOrConfig]
    : dsaOrConfig;

  return jwaConfig.algorithm === 'rsa'
    ? generateKeyPair({ type: 'rsa', format: 'jwk', modulusLength: 2048 })
    : generateKeyPair({
        type: 'ec',
        format: 'jwk',
        curve: jwaConfig.curve,
      });
};

const dsaJwaConfigMap = {
  [KeyAlgorithms.SECP256K1]: {
    algorithm: 'ec',
    curve: 'secp256k1',
  },
  [KeyAlgorithms.ES256]: {
    algorithm: 'ec',
    curve: 'P-256',
  },
  [KeyAlgorithms.RS256]: {
    algorithm: 'rsa',
  },
};

// eslint-disable-next-line complexity
const generateKeyPair = (options = {}) => {
  const { format = 'hex', type = 'ec' } = options;
  const specificOptions =
    type === 'ec'
      ? { namedCurve: options.curve ?? 'secp256k1' }
      : { modulusLength: options.modulusLength };
  const { privateKey, publicKey } = crypto.generateKeyPairSync(type, {
    publicKeyEncoding: { format: 'jwk' },
    privateKeyEncoding: { format: 'jwk' },
    ...specificOptions,
  });

  if (format === 'hex') {
    return {
      privateKey: keyto.from(privateKey, 'jwk').toString('blk', 'private'),
      publicKey: keyto.from(publicKey, 'jwk').toString('blk', 'public'),
    };
  }

  return { privateKey, publicKey };
};

const signPayload = (payload, privateKey, options) => {
  const key = secp256k1.keyFromPrivate(privateKey, 'hex');
  const signedValue = prepareSignedValue(payload, options);

  return key.sign(signedValue).toDER('hex');
};

const verifyPayload = (payload, signature, publicKey, options) => {
  try {
    const key = secp256k1.keyFromPublic(publicKey, 'hex');
    const signedValue = prepareSignedValue(payload, options);

    return key.verify(signedValue, signature);
  } catch (error) {
    // eslint-disable-next-line better-mutation/no-mutation
    error.data = {
      function: 'verifyPayload',
      args: { payload, signature, publicKey, options },
    };
    throw error;
  }
};

const prepareSignedValue = (payload, options) => {
  const hexOptions = flow(
    sanitizeOptions,
    ensureStringified,
    hashAndEncodeHex,
  )(options);
  const hexPayload = flow(
    sanitizePayload,
    ensureStringified,
    hashAndEncodeHex,
  )(payload);
  return hashAndEncodeHex(`${hexOptions}${hexPayload}`);
};

const publicKeyHexToPem = (publicKey) =>
  keyto.from(publicKey, 'blk').toString('pem', 'public_pkcs8');

const sanitizeOptions = (options) => {
  const objOptions = !isString(options) ? options : JSON.parse(options);
  return omit(['jws'], objOptions);
};

const sanitizePayload = (payload) => {
  const objPayload = !isString(payload) ? payload : JSON.parse(payload);
  return omit(['proof'], objPayload);
};

const ensureStringified = (objJson) => {
  return isString(objJson) ? objJson : JSON.stringify(objJson);
};

const hashAndEncodeHex = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const get2BytesHash = (value) => {
  return `0x${hashAndEncodeHex(value).slice(0, 4)}`;
};

const signAndEncodeBase64 = (value, privateKey) => {
  const privateKeyPem = keyto
    .from(privateKey, 'blk')
    .toString('pem', 'private_pkcs8');
  return crypto
    .createSign('SHA256')
    .update(value)
    .sign({
      key: privateKeyPem,
    })
    .toString('base64');
};

const verifyBase64Signature = (value, signature, publicKey) => {
  return crypto
    .createVerify('SHA256')
    .update(value)
    .verify(
      {
        key: publicKeyHexToPem(publicKey),
      },
      signature,
      'base64',
    );
};

const encryptBuffer = (buffer, secret) =>
  doEncrypt(secret, (cipher) => cipher.update(buffer));

const encrypt = (text, secret) =>
  doEncrypt(secret, (cipher) => cipher.update(text, 'utf8')).toString('base64');

const decryptBuffer = (encrypted, secret) =>
  doDecrypt(encrypted, secret, (encryptedBuffer, decipher) =>
    Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]),
  );

const decrypt = (encrypted, secret) => {
  const bData = Buffer.from(encrypted, 'base64');
  return doDecrypt(
    bData,
    secret,
    (encryptedBuffer, decipher) =>
      decipher.update(encryptedBuffer, 'binary', 'utf8') +
      decipher.final('utf8'),
  );
};

const doEncrypt = (secret, callback) => {
  const salt = crypto.randomBytes(64);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(secret, salt, 2145, 32, 'sha512');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([callback(cipher), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]);
};

const doDecrypt = (encrypted, secret, callback) => {
  const salt = encrypted.slice(0, 64);
  const iv = encrypted.slice(64, 80);
  const tag = encrypted.slice(80, 96);
  const buffer = encrypted.slice(96);
  const key = crypto.pbkdf2Sync(secret, salt, 2145, 32, 'sha512');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return callback(buffer, decipher);
};

const generateRandomNumber = (length) =>
  randomNumber(
    parseInt(`1${'0'.repeat(length - 1)}`, 10),
    parseInt('9'.repeat(length), 10),
  );

const isStringHex = (str) => HEX_FORMAT.test(str);

const calculateDigest = (alg, enc) => (value) =>
  crypto.createHash(alg).update(value).digest(enc);

const calcSha384 = calculateDigest('sha384', 'base64');

const initBuildRefreshToken = (bitLength = 512) => {
  const byteLength = bitLength / 8;
  return () => generateRandomBytes(byteLength).toString('hex');
};

const deriveEncryptionSecretFromPassword = async (password) => {
  const salt = Buffer.from(password.slice(-16), 'hex');
  const secret = await argon2.hash(password, {
    type: argon2.argon2i,
    salt,
    raw: true,
    memoryCost: 4096,
    parallelism: 1,
  });
  return secret.toString('hex');
};

module.exports = {
  createCommitment,
  deriveEncryptionSecretFromPassword,
  generateRandomBytes,
  generateKeyPair,
  generatePositive256BitHexString,
  publicKeyHexToPem,
  encrypt,
  decrypt,
  encryptBuffer,
  decryptBuffer,
  signPayload,
  verifyPayload,
  hashAndEncodeHex,
  signAndEncodeBase64,
  verifyBase64Signature,
  generateRandomNumber,
  isStringHex,
  get2BytesHash,
  calculateDigest,
  initBuildRefreshToken,
  generateJWAKeyPair,
  calcSha384,
};
