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

const { flow, isEmpty, isString, map, mapValues, pick } = require('lodash/fp');
const { safeJwtDecode } = require('@verii/jwt');

// These reduce credentials, issuer dependencies and DID documents for logging.
// Each keeps its keys, nesting and array-of-objects shape, with only the
// fields that identify each part. Credential subjects, JWTs, keys and other
// claims are left out.

const DID_DOCUMENT_ENTRY_KEYS = ['publicKey', 'verificationMethod', 'service'];
const DID_DOCUMENT_ENTRY_FIELDS = ['id', 'type', 'credentialType'];

const didDocumentForLog = (didDocument) =>
  didDocument == null
    ? didDocument
    : {
        ...pick(['id', 'alsoKnownAs'], didDocument),
        ...flow(
          pick(DID_DOCUMENT_ENTRY_KEYS),
          mapValues(map(pick(DID_DOCUMENT_ENTRY_FIELDS))),
        )(didDocument),
      };

const decodedJwtForLog = (decodedJwt) =>
  decodedJwt == null
    ? decodedJwt
    : {
        header: pick(['alg', 'kid', 'typ'], decodedJwt.header),
        payload: pick(['iss', 'jti'], decodedJwt.payload),
      };

const issuerForLog = (issuer) =>
  isString(issuer) ? issuer : pick(['id'], issuer);

const credentialForLog = (credential) =>
  credential == null
    ? credential
    : {
        ...pick(['id', 'type'], credential),
        ...(credential.issuer == null
          ? {}
          : { issuer: issuerForLog(credential.issuer) }),
      };

// The bound issuer VC is a JWT, so it is logged as its decoded header and
// issuer claims. A missing dependency is null.
const IssuerDependencyReducers = {
  boundIssuerVc: (jwt) => decodedJwtForLog(safeJwtDecode(jwt)),
  issuerAccreditation: pick(['id']),
  issuerDidDocument: didDocumentForLog,
  credentialTypeMetadata: pick(['credentialType']),
};

const issuerDependenciesForLog = (dependencies) =>
  Object.fromEntries(
    Object.entries(IssuerDependencyReducers).map(([key, reduce]) => [
      key,
      isEmpty(dependencies?.[key]) ? null : reduce(dependencies[key]),
    ]),
  );

module.exports = {
  credentialForLog,
  decodedJwtForLog,
  didDocumentForLog,
  issuerDependenciesForLog,
};
