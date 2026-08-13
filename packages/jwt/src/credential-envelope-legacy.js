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

const { isEmpty, isObject } = require('lodash/fp');

const buildDecodedCredential = (payload) => ({
  ...payload.vc,
  id: payload.jti,
  ...issuer(payload),
  ...credentialSubject(payload),
  ...issuanceDate(payload, payload.vc.issuanceDate),
  ...expirationDate(payload),
});

const buildDecodedPresentation = (payload) => ({
  ...payload.vp,
  id: payload.jti,
  ...issuer(payload),
  ...verifier(payload),
  ...issuanceDate(payload, payload.vp.issuanceDate),
  ...expirationDate(payload),
});

const credentialSubject = (payload) => ({
  credentialSubject: {
    ...payload.vc.credentialSubject,
    ...(payload.sub ? { id: payload.sub } : {}),
  },
});

const expirationDate = (payload) =>
  payload.exp ? { expirationDate: timestampToIsoDateString(payload.exp) } : {};

const issuanceDate = (payload, existingIssuanceDate) =>
  existingIssuanceDate == null && (payload.iat ?? payload.nbf)
    ? { issuanceDate: timestampToIsoDateString(payload.iat ?? payload.nbf) }
    : {};

// eslint-disable-next-line complexity
const issuer = ({ iss, vc }) => {
  const issuerPayload = vc?.issuer || {};

  if (isEmpty(iss) && isEmpty(issuerPayload)) {
    return {};
  }

  return {
    issuer: {
      ...(isObject(issuerPayload) ? issuerPayload : {}),
      ...(iss ? { id: iss } : {}),
    },
  };
};

const timestampToIsoDateString = (timestamp) =>
  new Date(timestamp * 1000).toISOString();

const verifier = ({ aud }) => (aud ? { verifier: aud } : {});

module.exports = {
  buildDecodedCredential,
  buildDecodedPresentation,
};
