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

const {
  SignJWT,
  jwtVerify: joseJwtVerify,
  importJWK,
  calculateJwkThumbprint,
  decodeJwt,
  decodeProtectedHeader,
} = require('jose');
const keyto = require('@trust/keyto');
const { flow, isString, startsWith, split, omit } = require('lodash/fp');
const {
  setIssuedAt,
  setOptionalNotBefore,
  setProtectedHeader,
  setOptionalJti,
  setOptionalIssuer,
  setOptionalAudience,
  setOptionalExpirationTime,
  setOptionalSubject,
} = require('./jwt-fp');

const toKeyObject = (key, header) => {
  const alg = header?.alg ?? key.alg ?? 'ES256K';
  return importJWK(key, alg);
};

const DEFAULT_ASYMMETRIC_ALG = 'ES256K';
const DEFAULT_SYMMETRIC_ALG = 'HS256';

const jwtSign = async (
  payload,
  keyOrSecret,
  {
    nbf,
    iat,
    jti,
    issuer,
    audience,
    subject,
    exp,
    expiresIn,
    alg: optionsAlg,
    ...options
  } = {}
) => {
  try {
    const wrapper =
      typeof payload.sign === 'function' ? payload : new SignJWT(payload);
    const { key, alg } = await prepAlgAndKey(keyOrSecret, optionsAlg);
    const jwt = flow(
      setOptionalNotBefore(nbf),
      setOptionalJti(jti),
      setOptionalIssuer(issuer),
      setOptionalAudience(audience),
      setOptionalExpirationTime(exp ?? expiresIn),
      setOptionalSubject(subject),
      setIssuedAt(iat),
      setProtectedHeader({ typ: 'JWT', alg, ...options })
    )(wrapper);

    return jwt.sign(key);
  } catch (error) /* istanbul ignore next */ {
    if (['test', 'development'].includes(process.env.NODE_ENV)) {
      console.error(
        `Error signing the payload ${JSON.stringify({
          payload,
          keyOrSecret,
          options,
        })}`
      );
      console.error(error);
    }
    throw error;
  }
};

const jwtDecode = (jwt) => ({
  payload: decodeJwt(jwt),
  header: decodeProtectedHeader(jwt),
});

const safeJwtDecode = (jwt) => {
  try {
    return jwtDecode(jwt);
  } catch {
    return null;
  }
};

const jwtVerify = async (jwt, keyOrSecret, options = {}) => {
  const header = decodeProtectedHeader(jwt);
  const keyObject = isString(keyOrSecret)
    ? new TextEncoder().encode(keyOrSecret)
    : await toKeyObject(keyOrSecret, header);
  const { payload } = await joseJwtVerify(jwt, keyObject, {
    clockTolerance: '120s',
    ...options,
  });
  return { header, payload };
};

const isPem = startsWith('-----BEGIN');

const jwkFromSecp256k1Key = (key, priv = true) => {
  const k = isPem(key) ? keyto.from(key, 'pem') : keyto.from(key, 'blk');
  const rawJwk = k.toJwk(priv ? 'private' : 'public');
  return {
    ...rawJwk,
    kty: 'EC',
    use: 'sig',
  };
};

const jwkFromStringified = (key, priv = true) => {
  const k = keyto.from(key, 'jwk');
  return k.toJwk(priv ? 'private' : 'public');
};

const jwkThumbprint = calculateJwkThumbprint;

const jwtHeaderDecode = decodeProtectedHeader;

const stringifyJwk = (jwk, priv = true) => {
  return keyto.from(jwk, 'jwk').toString('jwk', priv ? 'private' : 'public');
};

const hexFromJwk = (jwk, priv = true) => {
  return keyto.from(jwk, 'jwk').toString('blk', priv ? 'private' : 'public');
};

// TO DO: Try to implement this on crypto package without jose dependency
const publicKeyFromPrivateKey = (key) => {
  return key.x == null
    ? keyto.from(key, 'blk').toString('blk', 'public')
    : omit(['d'], key);
};

const tamperJwt = (jwt, mergeObj) => {
  const [headerBase64, payloadBase64, signatureBase64] = split('.', jwt);
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
  const tamperedPayload = {
    ...payload,
    ...mergeObj,
  };
  const tamperedPayloadJson = JSON.stringify(tamperedPayload);
  const tamperedPayloadBuffer = Buffer.from(tamperedPayloadJson);
  const tamperedPayloadBase64String = tamperedPayloadBuffer.toString('base64');
  const trimmedStr = tamperedPayloadBase64String.replace(/=+$/, '');
  return `${headerBase64}.${trimmedStr}.${signatureBase64}`;
};

const jwtSignSymmetric = async (payload, key, { alg = 'HS256' } = {}) => {
  const secret = new TextEncoder().encode(key);
  const result = await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .sign(secret);
  return result;
};

const deriveJwk = (jwt, key) => {
  const candidate = key != null ? key : jwtDecode(jwt)?.header?.jwk;
  return candidate.x != null
    ? candidate
    : jwkFromSecp256k1Key(candidate, false);
};

const toJwk = (key, priv = true) => {
  return key.x != null ? key : jwkFromSecp256k1Key(key, priv);
};

const prepAlgAndKey = async (keyOrSecret, optionsAlg) =>
  isString(keyOrSecret)
    ? {
        alg: optionsAlg ?? DEFAULT_SYMMETRIC_ALG,
        key: new TextEncoder().encode(keyOrSecret),
      }
    : {
        alg: keyOrSecret.alg ?? optionsAlg ?? DEFAULT_ASYMMETRIC_ALG,
        key: await toKeyObject(keyOrSecret),
      };

module.exports = {
  deriveJwk,
  hexFromJwk,
  jwkFromSecp256k1Key,
  jwkFromStringified,
  jwtDecode,
  jwtHeaderDecode,
  jwtSign,
  jwtSignSymmetric,
  jwkThumbprint,
  jwtVerify,
  publicKeyFromPrivateKey,
  safeJwtDecode,
  stringifyJwk,
  tamperJwt,
  toJwk,
};
