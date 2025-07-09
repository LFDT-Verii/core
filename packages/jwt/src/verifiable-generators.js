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

const { omit } = require('lodash/fp');
const { getUnixTime } = require('date-fns/fp');
const { docJti, generateDocJwt } = require('./docs');
const { getExpirationISODate, getIssuerId } = require('./vc-mappers');

// Using credential structure as defined at: https://w3c.github.io/vc-imp-guide/
// Using JWT structure as defined at: https://www.w3.org/TR/vc-data-model/#json-web-token
const generateCredentialJwt = (credentialWrapper, key, kid) => {
  const credential = unwrap('vc', credentialWrapper);
  const payload = {
    vc: {
      ...omit(['credentialSubject', 'issued'], credential),
      credentialSubject: {
        ...omit(['jwk'], credential.credentialSubject),
      },
    },
  };

  if (credential.credentialSubject.jwk != null) {
    payload.sub_jwk = credential.credentialSubject.jwk;
  }

  const options = {
    ...docJti(credential),
    ...iatAndNbf(credential),
    ...issCredential(credential),
    ...exp(credential),
    ...sub(credential),
    kid,
  };

  return generateDocJwt(payload, key, options);
};

// Using presentation structure as defined at: https://w3c.github.io/vc-imp-guide/
// Using JWT structure as defined at: https://www.w3.org/TR/vc-data-model/#json-web-token
const generatePresentationJwt = (presentationWrapper, key, kid) => {
  const presentation = unwrap('vp', presentationWrapper);
  const payload = {
    vp: {
      ...omit(
        ['id', 'issuer', 'verifier', 'issued', 'expirationDate'],
        presentation
      ),
    },
  };
  const options = {
    ...docJti(presentation),
    ...iatAndNbf(presentation),
    ...exp(presentation),
    ...issPresentation(presentation),
    ...aud(presentation),
    kid,
  };

  return generateDocJwt(payload, key, options);
};

const iatAndNbf = ({ issued, issuanceDate }) => {
  if (issued == null && issuanceDate == null) {
    return {};
  }
  const isoDate = issuanceDate ?? issued;
  const iatVal = getUnixTime(new Date(isoDate));
  return { iat: iatVal, nbf: iatVal };
};

const exp = (verifiable) => {
  const expiryISODate = getExpirationISODate(verifiable);
  return expiryISODate ? { exp: getUnixTime(new Date(expiryISODate)) } : {};
};

const issCredential = (credential) => {
  const issuerId = getIssuerId(credential.issuer);
  return issuerId ? { issuer: issuerId } : {};
};

const sub = (verifiable) =>
  verifiable.credentialSubject.id
    ? { subject: verifiable.credentialSubject.id }
    : {};

const issPresentation = (presentation) =>
  presentation.issuer ? { issuer: presentation.issuer } : {};

const aud = (verifiable) =>
  verifiable.verifier ? { audience: verifiable.verifier } : {};

const unwrap = (propName, wrapper) =>
  wrapper[propName] ? wrapper[propName] : wrapper;

module.exports = {
  generatePresentationJwt,
  generateCredentialJwt,
};
