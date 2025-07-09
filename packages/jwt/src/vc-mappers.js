/*
 * Copyright 2025 Velocity Team
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
 *
 */

const { omit } = require('lodash/fp');
const { getUnixTime } = require('date-fns/fp');

// Using credential structure as defined at: https://w3c.github.io/vc-imp-guide/ conformant to JWS JSON Serialization
// https://www.rfc-editor.org/rfc/rfc7515#section-7.2.1,
const jsonLdToUnsignedVcJwtContent = (jsonldCredential, kid) => {
  const header = { kid, typ: 'JWT' };
  const iat = getUnixTime(
    new Date(
      jsonldCredential.issued ?? jsonldCredential.issuanceDate ?? new Date()
    )
  );
  const payload = {
    vc: {
      // vc property is not needed in v2.0
      ...omit(['credentialSubject', 'issued'], jsonldCredential),
      credentialSubject: {
        ...omit(['jwk'], jsonldCredential.credentialSubject),
      },
    },
    iss: getIssuerId(jsonldCredential.issuer),
    jti: jsonldCredential.id,
    iat,
    nbf: iat, // not needed in v2.0
  };

  if (jsonldCredential.credentialSubject.id != null) {
    payload.sub = jsonldCredential.credentialSubject.id;
  }
  if (jsonldCredential.credentialSubject.jwk != null) {
    payload.sub_jwk = jsonldCredential.credentialSubject.jwk;
  }
  const expirationISODate = getExpirationISODate(jsonldCredential);
  if (expirationISODate != null) {
    payload.exp = getUnixTime(new Date(expirationISODate));
  }

  return { header, payload };
};

const getIssuerId = (issuer) => issuer?.id ?? issuer;

const getExpirationISODate = (verifiable) =>
  verifiable.validTo ?? verifiable.expirationDate;

module.exports = {
  getIssuerId,
  getExpirationISODate,
  jsonLdToUnsignedVcJwtContent,
};
