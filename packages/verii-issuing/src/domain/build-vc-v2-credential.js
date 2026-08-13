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

const { getV2CredentialModelViolation } = require('@verii/jwt');
const { isObject, uniq } = require('lodash/fp');

const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

/**
 * Builds a conforming Velocity VC Data Model 2.0 document from canonical
 * credential input.
 * @param {object} credentialInput version-neutral credential input
 * @returns {object} VC Data Model 2.0 document
 */
const buildVcV2Credential = (credentialInput) => {
  assertCanonicalInput(credentialInput);

  const credential = {
    '@context': uniq([VC_V2_CONTEXT, ...credentialInput.contexts]),
    id: credentialInput.id,
    type: uniq([
      'VerifiableCredential',
      ...credentialInput.types.filter(
        (type) => type !== 'VerifiableCredential',
      ),
    ]),
    issuer: credentialInput.issuer,
    validFrom: credentialInput.validity.from,
    ...buildOptionalValidity(credentialInput.validity),
    credentialSubject: buildCredentialSubject(credentialInput),
    credentialSchema: credentialInput.schema,
    credentialStatus: credentialInput.status,
    contentHash: {
      type: 'VelocityContentHash2020',
      value: credentialInput.contentHash,
    },
    vnfProtocolVersion: credentialInput.vnfProtocol.version,
    ...buildOptionalRefreshService(credentialInput.refreshService),
  };

  assertBuiltCredential(credential);

  return credential;
};

/**
 * Validates the emitted VC 2.0 profile.
 * @param {object} credential emitted credential
 * @returns {void}
 */
const assertBuiltCredential = (credential) => {
  const violation = getV2CredentialModelViolation(credential);
  if (violation == null) {
    return;
  }
  const property = violation.property == null ? '' : `: ${violation.property}`;
  const profile =
    violation.type === 'profile'
      ? 'Velocity profile'
      : `${violation.type} profile`;
  throw new TypeError(
    `Built VC 2.0 document violates the ${profile}${property}`,
  );
};

/**
 * Validates the canonical input shape and extension context.
 * @param {object} credentialInput version-neutral credential input
 * @returns {void}
 */
const assertCanonicalInput = (credentialInput) => {
  if (!hasCanonicalInputShape(credentialInput)) {
    throw new TypeError('VC 2.0 builder requires canonical credential input');
  }
  if (!credentialInput.contexts.includes(credentialInput.extensionContext)) {
    throw new TypeError(
      'VC 2.0 builder requires the pinned Velocity extension context',
    );
  }
  if (
    credentialInput.validity.until != null &&
    Date.parse(credentialInput.validity.from) >
      Date.parse(credentialInput.validity.until)
  ) {
    throw new TypeError('VC 2.0 validity end must not precede its start');
  }
};

/**
 * Tests the required canonical input structure.
 * @param {unknown} credentialInput input candidate
 * @returns {boolean} true when the canonical structure is present
 */
const hasCanonicalInputShape = (credentialInput) =>
  isObject(credentialInput) &&
  Array.isArray(credentialInput.contexts) &&
  Array.isArray(credentialInput.types) &&
  isObject(credentialInput.claims) &&
  isObject(credentialInput.validity) &&
  isObject(credentialInput.vnfProtocol);

/**
 * Builds a VC 2.0 credential subject.
 * @param {object} credentialInput canonical credential input
 * @param {object} credentialInput.claims credential claims
 * @param {string} [credentialInput.holder] holder identifier
 * @returns {object} credential subject
 */
const buildCredentialSubject = ({ claims, holder }) => ({
  ...(holder == null ? {} : { id: holder }),
  ...claims,
});

/**
 * Builds the optional refresh-service property.
 * @param {object | object[] | undefined} refreshService refresh service value
 * @returns {object} optional property fragment
 */
const buildOptionalRefreshService = (refreshService) =>
  refreshService == null ? {} : { refreshService };

/**
 * Builds the optional validity-end property.
 * @param {object} validity validity interval
 * @param {string} [validity.until] interval end
 * @returns {object} optional property fragment
 */
const buildOptionalValidity = ({ until }) =>
  until == null ? {} : { validUntil: until };

module.exports = { buildVcV2Credential };
