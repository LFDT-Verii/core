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
  CredentialEnvelopeFormats,
  decodeCredentialEnvelope,
} = require('./credential-envelope-codec');
const { jwsVerify } = require('./core');
const {
  V2CredentialModelViolationTypes,
  getV2CredentialModelViolation,
} = require('./v2-credential-model-validator');

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

const MAX_KID_CHARACTERS = 2048;

const verifyCredentialEnvelope = async (
  compact,
  verificationKey,
  verifyCompact = jwsVerify,
) => {
  const verifiedEnvelope = decodeCredentialEnvelope(compact);
  const resolvedVerificationKey =
    typeof verificationKey === 'function'
      ? verificationKey(verifiedEnvelope)
      : verificationKey;
  assertProtectedHeader(verifiedEnvelope);
  assertAlgorithmKeyMatch(
    verifiedEnvelope.protectedHeader.alg,
    resolvedVerificationKey,
  );
  await verifyCompact(compact, resolvedVerificationKey);
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
  assertV2StaticModel(credential);
  assertV2ValidityInterval(credential);
  assertKidBinding(credential.id, protectedHeader.kid);
  assertSelfSignedIssuerBinding(credential.issuer, protectedHeader.kid);
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
    (protectedHeader.typ !== CredentialEnvelopeFormats.VC_JWT ||
      protectedHeader.cty !== 'vc')
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

const assertV2StaticModel = (credential) => {
  const violation = getV2CredentialModelViolation(credential);
  if (violation == null) {
    return;
  }

  if (violation.type === V2CredentialModelViolationTypes.CONTEXT) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.CONTEXT_INVALID,
      'VC 2.0 contexts must be a bounded list of HTTPS URLs or inline definitions',
    );
  }
  if (violation.type === V2CredentialModelViolationTypes.COMPATIBILITY_CLAIM) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      `VC 2.0 direct payload contains forbidden ${violation.property} claim`,
    );
  }
  if (violation.type === V2CredentialModelViolationTypes.DATE_TIME) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      `VC 2.0 ${violation.property} must be an ISO date-time`,
    );
  }
  if (violation.type === V2CredentialModelViolationTypes.SCHEMA) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      'VC 2.0 credentialSchema must contain bounded id and type values',
    );
  }
  throw new CredentialVerificationError(
    CredentialVerificationErrorCodes.MODEL_INVALID,
    'VC 2.0 credential is missing or has invalid required properties',
  );
};

const assertV2ValidityInterval = ({ validFrom, validUntil }) => {
  if (!isValidityIntervalOrdered(validFrom, validUntil)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      'VC 2.0 credential is missing or has invalid required properties',
    );
  }
};

const isJsonObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const isExpectedKey = (jwk, expectedKey) => {
  if (jwk.kty !== expectedKey?.kty) {
    return false;
  }
  return expectedKey.crv == null
    ? jwk.crv == null
    : jwk.crv === expectedKey.crv;
};

const isValidityIntervalOrdered = (validFrom, validUntil) =>
  validUntil == null || Date.parse(validUntil) >= Date.parse(validFrom);

module.exports = {
  AlgorithmKeyProfiles,
  CredentialVerificationError,
  CredentialVerificationErrorCodes,
  VersionAlgorithmAllowlists,
  verifyCredentialEnvelope,
};
