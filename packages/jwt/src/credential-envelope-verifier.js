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

const {
  CredentialDataModelVersions,
  CredentialEnvelopeError,
  decodeCredentialEnvelope,
} = require('./credential-envelope-codec');
const { jwsVerify } = require('./core');

const CredentialVerificationErrorCodes = Object.freeze({
  ALGORITHM_KEY_MISMATCH: 'CREDENTIAL_ALGORITHM_KEY_MISMATCH',
  CONTEXT_INVALID: 'CREDENTIAL_CONTEXT_INVALID',
  HEADER_INVALID: 'CREDENTIAL_HEADER_INVALID',
  KID_BINDING_INVALID: 'CREDENTIAL_KID_BINDING_INVALID',
  MODEL_INVALID: 'CREDENTIAL_MODEL_INVALID',
  UNSUPPORTED_ALGORITHM: 'CREDENTIAL_UNSUPPORTED_ALGORITHM',
});

class CredentialVerificationError extends CredentialEnvelopeError {
  constructor(code, message) {
    super(code, message);
    this.name = 'CredentialVerificationError';
  }
}

const AlgorithmKeyProfiles = Object.freeze({
  ES256: Object.freeze({ crv: 'P-256', kty: 'EC' }),
  ES256K: Object.freeze({ crv: 'secp256k1', kty: 'EC' }),
  RS256: Object.freeze({ kty: 'RSA' }),
});

const VersionAlgorithmAllowlists = Object.freeze({
  [CredentialDataModelVersions.V1_1]: Object.freeze([
    'ES256K',
    'ES256',
    'RS256',
  ]),
  [CredentialDataModelVersions.V2_0]: Object.freeze([
    'ES256K',
    'ES256',
    'RS256',
  ]),
});

const MAX_CONTEXTS = 16;
const MAX_CONTEXT_CHARACTERS = 2048;
const MAX_KID_CHARACTERS = 2048;
const V2_FORBIDDEN_COMPATIBILITY_CLAIMS = Object.freeze([
  'exp',
  'iat',
  'iss',
  'jti',
  'nbf',
  'sub',
  'vc',
  'vp',
]);

const verifyCredentialEnvelope = async (compact, verificationKey) => {
  const routingEnvelope = decodeCredentialEnvelope(compact);
  assertProtectedHeader(routingEnvelope);
  assertAlgorithmKeyMatch(routingEnvelope.protectedHeader.alg, verificationKey);
  await jwsVerify(compact, verificationKey);

  const verifiedEnvelope = decodeCredentialEnvelope(compact);
  assertCredentialModel(verifiedEnvelope);

  return {
    ...verifiedEnvelope,
    signingAlgorithm: verifiedEnvelope.protectedHeader.alg,
  };
};

const assertAlgorithmKeyMatch = (algorithm, jwk) => {
  const expectedKey = AlgorithmKeyProfiles[algorithm];
  if (!isJsonObject(jwk) || !isExpectedKey(jwk, expectedKey)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
      `Credential algorithm ${algorithm} does not match the resolved JWK`,
    );
  }
};

const assertCredentialModel = (envelope) => {
  if (envelope.dataModelVersion === CredentialDataModelVersions.V1_1) {
    return;
  }

  const { credential, protectedHeader } = envelope;
  assertV2Contexts(credential['@context']);
  assertV2RequiredProperties(credential);
  assertV2Schema(credential.credentialSchema);
  assertNoCompatibilityClaims(credential);
  assertKidBinding(credential.id, protectedHeader.kid);
  assertSelfSignedIssuerBinding(credential.issuer, protectedHeader.kid);
};

const assertNoCompatibilityClaims = (credential) => {
  const forbiddenClaim = V2_FORBIDDEN_COMPATIBILITY_CLAIMS.find((claim) =>
    Object.hasOwn(credential, claim),
  );
  if (forbiddenClaim != null) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      `VC 2.0 direct payload contains forbidden ${forbiddenClaim} claim`,
    );
  }
};

const assertKidBinding = (credentialId, kid) => {
  if (
    typeof credentialId !== 'string' ||
    typeof kid !== 'string' ||
    kid.length > MAX_KID_CHARACTERS ||
    !kid.startsWith(`${credentialId}#`) ||
    kid.length === credentialId.length + 1
  ) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.KID_BINDING_INVALID,
      'VC 2.0 kid must identify a key anchored to the credential id',
    );
  }
};

const assertNoInvalidDate = (value, property) => {
  if (value != null && !isIsoDate(value)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      `VC 2.0 ${property} must be an ISO date-time`,
    );
  }
};

const assertProtectedHeader = ({ dataModelVersion, protectedHeader }) => {
  const allowedAlgorithms = VersionAlgorithmAllowlists[dataModelVersion];
  if (!allowedAlgorithms.includes(protectedHeader.alg)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.UNSUPPORTED_ALGORITHM,
      `Credential algorithm ${protectedHeader.alg} is not allowed for VC ${dataModelVersion}`,
    );
  }

  if (
    dataModelVersion === CredentialDataModelVersions.V2_0 &&
    (protectedHeader.typ !== 'vc+jwt' || protectedHeader.cty !== 'vc')
  ) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.HEADER_INVALID,
      'VC 2.0 protected header requires typ vc+jwt and cty vc',
    );
  }
};

const assertSelfSignedIssuerBinding = (issuer, kid) => {
  const keyController = kid.split('#')[0];
  if (!keyController.startsWith('did:jwk:')) {
    return;
  }

  const issuerId = typeof issuer === 'string' ? issuer : issuer?.id;
  if (issuerId !== keyController) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.KID_BINDING_INVALID,
      'VC 2.0 self-signed issuer must control the resolved did:jwk key',
    );
  }
};

const assertV2Contexts = (contexts) => {
  const isBoundedContextArray =
    Array.isArray(contexts) &&
    contexts.length > 0 &&
    contexts.length <= MAX_CONTEXTS;
  if (!isBoundedContextArray || !contexts.every(isValidContextEntry)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.CONTEXT_INVALID,
      'VC 2.0 contexts must be a bounded list of HTTPS URLs or inline definitions',
    );
  }
};

const assertV2RequiredProperties = (credential) => {
  const issuerId =
    typeof credential.issuer === 'string'
      ? credential.issuer
      : credential.issuer?.id;
  assertNoInvalidDate(credential.validFrom, 'validFrom');
  assertNoInvalidDate(credential.validUntil, 'validUntil');
  const requiredPropertiesValid = [
    isNonEmptyString(credential.id),
    isNonEmptyString(issuerId),
    isCredentialSubject(credential.credentialSubject),
    credential.validFrom != null,
    isValidityIntervalOrdered(credential.validFrom, credential.validUntil),
  ].every(Boolean);

  if (!requiredPropertiesValid) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      'VC 2.0 credential is missing or has invalid required properties',
    );
  }
};

const assertV2Schema = (credentialSchema) => {
  if (credentialSchema == null) {
    return;
  }

  const schemas = Array.isArray(credentialSchema)
    ? credentialSchema
    : [credentialSchema];
  const valid =
    schemas.length > 0 &&
    schemas.length <= MAX_CONTEXTS &&
    schemas.every(
      (schema) =>
        isJsonObject(schema) &&
        typeof schema.id === 'string' &&
        schema.id.length <= MAX_CONTEXT_CHARACTERS &&
        typeof schema.type === 'string' &&
        schema.type.length > 0,
    );
  if (!valid) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      'VC 2.0 credentialSchema must contain bounded id and type values',
    );
  }
};

const RFC3339_DATE_TIME_PATTERN =
  /^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d{2}:\d{2}:\d{2})(?:\.\d+)?(?<offset>Z|[+-]\d{2}:\d{2})$/u;

// eslint-disable-next-line complexity
const isIsoDate = (value) => {
  if (typeof value !== 'string' || value.length > 64) {
    return false;
  }
  const match = RFC3339_DATE_TIME_PATTERN.exec(value);
  if (match == null || !isValidOffset(match.groups.offset)) {
    return false;
  }

  const { date, time } = match.groups;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1 &&
    month === calendarDate.getUTCMonth() + 1 &&
    day === calendarDate.getUTCDate() &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    !Number.isNaN(Date.parse(value))
  );
};

const isValidOffset = (offset) => {
  if (offset === 'Z') {
    return true;
  }
  const [, hour, minute] = /^[-+](\d{2}):(\d{2})$/u.exec(offset) ?? [];
  return Number(hour) <= 23 && Number(minute) <= 59;
};

const isJsonObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const isCredentialSubject = (credentialSubject) => {
  if (isJsonObject(credentialSubject)) {
    return true;
  }
  return (
    Array.isArray(credentialSubject) &&
    credentialSubject.length > 0 &&
    credentialSubject.every(isJsonObject)
  );
};

const isExpectedKey = (jwk, expectedKey) => {
  if (jwk.kty !== expectedKey?.kty) {
    return false;
  }
  return expectedKey.crv == null
    ? jwk.crv == null
    : jwk.crv === expectedKey.crv;
};

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

const isValidityIntervalOrdered = (validFrom, validUntil) =>
  validUntil == null || Date.parse(validUntil) >= Date.parse(validFrom);

const isValidContextEntry = (context) => {
  if (isJsonObject(context)) {
    return Object.keys(context).length > 0;
  }
  if (
    typeof context !== 'string' ||
    context.length === 0 ||
    context.length > MAX_CONTEXT_CHARACTERS
  ) {
    return false;
  }

  try {
    return new URL(context).protocol === 'https:';
  } catch {
    return false;
  }
};

module.exports = {
  AlgorithmKeyProfiles,
  CredentialVerificationError,
  CredentialVerificationErrorCodes,
  VersionAlgorithmAllowlists,
  verifyCredentialEnvelope,
};
