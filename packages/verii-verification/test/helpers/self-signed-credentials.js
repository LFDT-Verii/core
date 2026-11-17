/**
 * Copyright 2026 Velocity Team
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

const crypto = require('node:crypto');
const { omit } = require('lodash/fp');

const Envelopes = Object.freeze({
  V1_1: 'VC 1.1',
  V2_0: 'VC 2.0',
});

const JoseAlgorithms = Object.freeze({
  'P-256': 'ES256',
  secp256k1: 'ES256K',
});

/**
 * Builds a Career Wallet self-reported credential exactly as the holder app
 * signs it: a throwaway ES256 key, an embedded WebCrypto-exported `jwk`, no
 * `kid`, and a bare UUID as `iss`, `jti` and `vc.id`.
 * @param {object} keyPair the throwaway ES256 key pair
 * @returns {string} the compact JWT
 */
const buildCareerWalletSelfReportedCredential = ({ privateKey, publicKey }) => {
  const id = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  return compactSign(
    {
      aud: ' ',
      iat: issuedAt,
      iss: id,
      jti: id,
      nbf: issuedAt,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        credentialSubject: { phone: '+15555550100' },
        id,
        type: ['PhoneV1.0', 'VerifiableCredential'],
      },
    },
    privateKey,
    {
      alg: 'ES256',
      jwk: { ...publicKey, ext: true, key_ops: ['verify'] },
      typ: 'JWT',
    },
  );
};

/**
 * Encodes an arbitrary string as a `did:jwk`, so tests can build DIDs whose
 * value is not a well-formed JWK.
 * @param {string} value the string to encode, normally a serialized JWK
 * @returns {string} the `did:jwk` DID
 */
const encodeDidJwk = (value) =>
  `did:jwk:${Buffer.from(value).toString('base64url')}`;

/**
 * Signs a credential in the requested envelope with caller-chosen `kid` and
 * `jwk` protected-header members.
 * @param {string} envelope one of Envelopes
 * @param {object} credential the unsigned VC 1.1 or VC 2.0 credential
 * @param {object} privateJwk the EC private JWK
 * @param {object} header the `kid` and/or `jwk` protected-header members
 * @returns {string} the compact JWS
 */
const signCredential = (envelope, credential, privateJwk, header) =>
  envelope === Envelopes.V1_1
    ? compactSign(legacyJwtPayload(credential), privateJwk, {
        alg: joseAlgorithmFor(privateJwk),
        typ: 'JWT',
        ...header,
      })
    : compactSign(credential, privateJwk, {
        alg: joseAlgorithmFor(privateJwk),
        cty: 'vc',
        typ: 'vc+jwt',
        ...header,
      });

const legacyJwtPayload = (credential) => {
  const issuedAt = toNumericDate(credential.issuanceDate);
  return {
    exp: toNumericDate(credential.expirationDate),
    iat: issuedAt,
    iss: credential.issuer?.id ?? credential.issuer,
    jti: credential.id,
    nbf: issuedAt,
    vc: omit(['expirationDate', 'id', 'issuanceDate'], credential),
  };
};

const toNumericDate = (isoDate) => Math.floor(Date.parse(isoDate) / 1000);

const compactSign = (payload, privateJwk, protectedHeader) => {
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: crypto.createPrivateKey({ format: 'jwk', key: privateJwk }),
  });
  return `${signingInput}.${signature.toString('base64url')}`;
};

const joseAlgorithmFor = ({ crv }) => JoseAlgorithms[crv];

module.exports = {
  Envelopes,
  buildCareerWalletSelfReportedCredential,
  encodeDidJwk,
  signCredential,
};
