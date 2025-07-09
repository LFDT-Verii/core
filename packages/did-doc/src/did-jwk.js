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

const util = require('util');
const { calculateJwkThumbprint, base64url } = require('jose');
const canonicalize = require('canonicalize');

const DID_JWK_FORMAT = 'did:jwk:%s';
const utf8Decoder = new TextDecoder('utf-8');

const verifyJwk = async (jwk) => {
  await calculateJwkThumbprint(jwk);
};

const base64UrlToJwk = (base64String) => {
  const buffer = base64url.decode(base64String);
  return JSON.parse(utf8Decoder.decode(buffer));
};

const jwkToPublicBase64Url = (json) => base64url.encode(canonicalize(json));

const resolveDidJwkDocument = async (didJwkUri) =>
  getDidJwkDocument(getJwkFromDidUri(didJwkUri));

const getDidUriFromJwk = (publicJwk) => {
  const publicKey = jwkToPublicBase64Url(publicJwk);
  return util.format(DID_JWK_FORMAT, publicKey);
};

const getJwkFromDidUri = (didUri) => {
  const [prefix, method, suffix] = didUri.split(':');
  if (prefix !== 'did') {
    throw new URIError('must_be_did');
  }
  if (method !== 'jwk') {
    throw new URIError('must_be_did_jwt');
  }

  const [base64Key] = suffix.split('#');
  return base64UrlToJwk(base64Key);
};

const getDidJwkDocument = async (publicJwk) => {
  await verifyJwk(publicJwk);
  const didUri = getDidUriFromJwk(publicJwk);

  const verificationMethod = {
    id: '#0',
    type: 'JsonWebKey2020',
    controller: didUri,
    publicKeyJwk: publicJwk,
  };

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      { '@vocab': 'https://www.iana.org/assignments/jose#' },
    ],
    id: didUri,
    verificationMethod: [verificationMethod],
  };
};

module.exports = {
  getJwkFromDidUri,
  getDidUriFromJwk,
  getDidJwkDocument,
  resolveDidJwkDocument,
};
