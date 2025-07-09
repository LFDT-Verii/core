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
const multihash = require('multihashing');
const keyto = require('@trust/keyto');
const { HEX_FORMAT } = require('@verii/test-regexes');

const secp256k1 = new EC('secp256k1');

const generateRandomBytes = (byteLength) => crypto.randomBytes(byteLength);

const generatePositive256BitHexString = () =>
  `0x${crypto.randomBytes(32).toString('hex')}`;

const createCommitment = (val) => {
  const hash = multihash(val, 'sha2-256');
  return Buffer.from(hash).toString('base64');
};

const generateJWAKeyPair = (config) =>
  config.algorithm === 'rsa'
    ? generateKeyPair({ type: 'rsa', format: 'jwk', modulusLength: 2048 })
    : generateKeyPair({
        type: 'ec',
        format: 'jwk',
        curve: config.curve,
      });

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
    hashAndEncodeHex
  )(options);
  const hexPayload = flow(
    sanitizePayload,
    ensureStringified,
    hashAndEncodeHex
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
      'base64'
    );
};

const encrypt = (text, secret) => {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);
  const key = crypto.pbkdf2Sync(secret, salt, 2145, 32, 'sha512');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
};

const decrypt = (encrypted, secret) => {
  const bData = Buffer.from(encrypted, 'base64');
  const salt = bData.slice(0, 64);
  const iv = bData.slice(64, 80);
  const tag = bData.slice(80, 96);
  const text = bData.slice(96);
  const key = crypto.pbkdf2Sync(secret, salt, 2145, 32, 'sha512');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');
};

const generateRandomNumber = (length) =>
  randomNumber(
    parseInt(`1${'0'.repeat(length - 1)}`, 10),
    parseInt('9'.repeat(length), 10)
  );

const isStringHex = (str) => HEX_FORMAT.test(str);

const calculateDigest = (alg, enc) => (value) =>
  crypto.createHash(alg).update(value).digest(enc);

const calcSha384 = calculateDigest('sha384', 'base64');

const initBuildRefreshToken = (bitLength = 512) => {
  const byteLength = bitLength / 8;
  return () => generateRandomBytes(byteLength).toString('hex');
};

const deriveEncryptionSecretFromPassword = async (contentHash) => {
  const salt = Buffer.from(contentHash.slice(-16), 'hex');
  const secret = await argon2.hash(contentHash, {
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
