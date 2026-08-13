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

const { buildDecodedCredential } = require('./credential-envelope-legacy');

const CredentialContexts = Object.freeze({
  V1_1: 'https://www.w3.org/2018/credentials/v1',
  V2_0: 'https://www.w3.org/ns/credentials/v2',
});

const CredentialDataModelVersions = Object.freeze({
  V1_1: '1.1',
  V2_0: '2.0',
});

class CredentialEnvelopeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'CredentialEnvelopeError';
  }
}

const CredentialEnvelopeErrorCodes = Object.freeze({
  ALG_NONE: 'CREDENTIAL_ENVELOPE_ALG_NONE',
  COMPACT_JWS_INVALID: 'CREDENTIAL_ENVELOPE_COMPACT_JWS_INVALID',
  JSON_DEPTH_EXCEEDED: 'CREDENTIAL_ENVELOPE_JSON_DEPTH_EXCEEDED',
  JSON_INVALID: 'CREDENTIAL_ENVELOPE_JSON_INVALID',
  JSON_NOT_OBJECT: 'CREDENTIAL_ENVELOPE_JSON_NOT_OBJECT',
  MIXED_FORMAT: 'CREDENTIAL_ENVELOPE_MIXED_FORMAT',
  SEGMENT_TOO_LARGE: 'CREDENTIAL_ENVELOPE_SEGMENT_TOO_LARGE',
  UNSUPPORTED_CONTEXT: 'CREDENTIAL_ENVELOPE_UNSUPPORTED_CONTEXT',
  UNSUPPORTED_FORMAT: 'CREDENTIAL_ENVELOPE_UNSUPPORTED_FORMAT',
  WRONG_TYPE: 'CREDENTIAL_ENVELOPE_WRONG_TYPE',
});

const CredentialEnvelopeFormats = Object.freeze({
  JWT_VC_JSON_LD: 'jwt_vc_json-ld',
  VC_JWT: 'vc+jwt',
});

const CredentialEnvelopeLimits = Object.freeze({
  MAX_COMPACT_CHARACTERS: 1441802,
  MAX_JSON_DEPTH: 32,
  MAX_PAYLOAD_BYTES: 1048576,
  MAX_PROTECTED_HEADER_BYTES: 16384,
  MAX_SIGNATURE_BYTES: 16384,
});

/**
 * Parses and classifies a compact credential without verifying its signature.
 * The result is safe only for format routing. Authorization, issuer trust,
 * status, holder, and other security decisions require signature verification.
 */
const decodeCredentialEnvelope = (compact) => {
  const { payload, protectedHeader } = parseCompactJws(compact);
  const classification = classifyCredential(payload, protectedHeader);

  return {
    compact,
    credential:
      classification.dataModelVersion === CredentialDataModelVersions.V1_1
        ? buildDecodedCredential(payload)
        : payload,
    ...classification,
    protectedHeader,
  };
};

const getCredentialId = (value) => credentialFrom(value)?.id;

const getCredentialIssuer = (value) => credentialFrom(value)?.issuer;

const getCredentialSchema = (value) => credentialFrom(value)?.credentialSchema;

const getCredentialStatus = (value) => credentialFrom(value)?.credentialStatus;

const getCredentialSubject = (value) =>
  credentialFrom(value)?.credentialSubject;

const getCredentialTypes = (value) => credentialFrom(value)?.type;

const getCredentialValidity = (value) => {
  const credential = credentialFrom(value) || {};

  return {
    validFrom: firstDefined(credential.validFrom, credential.issuanceDate),
    validUntil: firstDefined(credential.validUntil, credential.expirationDate),
  };
};

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

const assertDepth = (value, depth = 1) => {
  if (depth > CredentialEnvelopeLimits.MAX_JSON_DEPTH) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.JSON_DEPTH_EXCEEDED,
      `Credential envelope JSON exceeds maximum depth ${CredentialEnvelopeLimits.MAX_JSON_DEPTH}`,
    );
  }

  if (value == null || typeof value !== 'object') {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    assertDepth(nestedValue, depth + 1);
  }
};

const assertNotMixed = ({
  directContext,
  hasVcClaim,
  hasVpClaim,
  nestedContext,
  usesV2Type,
}) => {
  const directWithCompatibilityClaim =
    directContext != null && [hasVcClaim, hasVpClaim].includes(true);
  const nestedWithV2Signal =
    hasVcClaim &&
    [usesV2Type, nestedContext === CredentialContexts.V2_0].includes(true);

  if ([directWithCompatibilityClaim, nestedWithV2Signal].includes(true)) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.MIXED_FORMAT,
      'Credential envelope contains mixed VC 1.1 and VC 2.0 signals',
    );
  }
};

const classifyCredential = (payload, protectedHeader) => {
  const directContext = firstContext(payload);
  const hasVcClaim = Object.hasOwn(payload, 'vc');
  const hasVpClaim = Object.hasOwn(payload, 'vp');
  const nestedContext = firstContext(payload.vc);
  const usesV2Type = protectedHeader.typ === CredentialEnvelopeFormats.VC_JWT;

  assertNotMixed({
    directContext,
    hasVcClaim,
    hasVpClaim,
    nestedContext,
    usesV2Type,
  });

  if (hasVpClaim) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.UNSUPPORTED_FORMAT,
      'Credential envelope payload contains a presentation claim',
    );
  }

  if (hasVcClaim) {
    return classifyNestedCredential(payload.vc, nestedContext);
  }

  return classifyDirectCredential(directContext, usesV2Type);
};

const classifyDirectCredential = (directContext, usesV2Type) => {
  assertSupportedContext(directContext);

  if (directContext === CredentialContexts.V1_1) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.UNSUPPORTED_FORMAT,
      'A VC 1.1 document must use the vc compatibility claim',
    );
  }

  if (!usesV2Type) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.WRONG_TYPE,
      'A direct VC 2.0 document requires typ vc+jwt',
    );
  }

  return {
    dataModelVersion: CredentialDataModelVersions.V2_0,
    envelopeFormat: CredentialEnvelopeFormats.VC_JWT,
  };
};

const classifyNestedCredential = (credential, nestedContext) => {
  assertJsonObject(credential, 'vc claim');
  assertSupportedContext(nestedContext);

  return {
    dataModelVersion: CredentialDataModelVersions.V1_1,
    envelopeFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
  };
};

const credentialFrom = (value) => value?.credential ?? value;

const decodeJsonSegment = (segment, name, maximumBytes) => {
  const decoded = decodeSegment(segment, name, maximumBytes);

  try {
    const parsed = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(decoded),
    );
    assertJsonObject(parsed, name);
    assertDepth(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof CredentialEnvelopeError) {
      throw error;
    }

    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.JSON_INVALID,
      `Credential envelope ${name} is not valid UTF-8 JSON`,
    );
  }
};

const decodeSegment = (segment, name, maximumBytes) => {
  if (
    typeof segment !== 'string' ||
    segment.length === 0 ||
    !BASE64URL_PATTERN.test(segment)
  ) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      `Credential envelope ${name} is not base64url`,
    );
  }

  if (segment.length > maximumEncodedLength(maximumBytes)) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.SEGMENT_TOO_LARGE,
      `Credential envelope ${name} exceeds ${maximumBytes} decoded bytes`,
    );
  }

  const decoded = Buffer.from(segment, 'base64url');
  assertCanonicalSegment(decoded, segment, name);
  assertDecodedSize(decoded, name, maximumBytes);

  return decoded;
};

const assertCanonicalSegment = (decoded, segment, name) => {
  if (decoded.toString('base64url') !== segment) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      `Credential envelope ${name} is not canonical base64url`,
    );
  }
};

const assertDecodedSize = (decoded, name, maximumBytes) => {
  if (decoded.length > maximumBytes) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.SEGMENT_TOO_LARGE,
      `Credential envelope ${name} exceeds ${maximumBytes} decoded bytes`,
    );
  }
};

const firstContext = (value) =>
  isJsonObject(value) && Array.isArray(value['@context'])
    ? value['@context'][0]
    : undefined;

const isJsonObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const firstDefined = (...values) => values.find((value) => value != null);

const maximumEncodedLength = (maximumBytes) => Math.ceil(maximumBytes / 3) * 4;

const parseCompactJws = (compact) => {
  assertCompactJws(compact);

  const segments = compact.split('.');
  if (segments.length !== 3) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      'Credential envelope must contain exactly three compact JWS segments',
    );
  }

  const protectedHeader = decodeJsonSegment(
    segments[0],
    'protected header',
    CredentialEnvelopeLimits.MAX_PROTECTED_HEADER_BYTES,
  );
  assertSupportedAlgorithm(protectedHeader);

  const payload = decodeJsonSegment(
    segments[1],
    'payload',
    CredentialEnvelopeLimits.MAX_PAYLOAD_BYTES,
  );
  decodeSegment(
    segments[2],
    'signature',
    CredentialEnvelopeLimits.MAX_SIGNATURE_BYTES,
  );

  return { payload, protectedHeader };
};

const assertCompactJws = (compact) => {
  const isBounded =
    typeof compact === 'string' &&
    compact.length <= CredentialEnvelopeLimits.MAX_COMPACT_CHARACTERS;

  if (!isBounded) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      'Credential envelope must be a bounded compact JWS string',
    );
  }
};

const assertSupportedAlgorithm = (protectedHeader) => {
  if (protectedHeader.alg === 'none') {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.ALG_NONE,
      'Credential envelope alg none is not allowed',
    );
  }
  if (
    typeof protectedHeader.alg !== 'string' ||
    protectedHeader.alg.length === 0
  ) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      'Credential envelope protected header requires alg',
    );
  }
};

const assertJsonObject = (value, name) => {
  if (!isJsonObject(value)) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.JSON_NOT_OBJECT,
      `Credential envelope ${name} must be a JSON object`,
    );
  }
};

const assertSupportedContext = (context) => {
  if (!Object.values(CredentialContexts).includes(context)) {
    throw new CredentialEnvelopeError(
      CredentialEnvelopeErrorCodes.UNSUPPORTED_CONTEXT,
      'Credential envelope has an unsupported first context',
    );
  }
};

module.exports = {
  CredentialContexts,
  CredentialDataModelVersions,
  CredentialEnvelopeError,
  CredentialEnvelopeErrorCodes,
  CredentialEnvelopeFormats,
  CredentialEnvelopeLimits,
  decodeCredentialEnvelope,
  getCredentialId,
  getCredentialIssuer,
  getCredentialSchema,
  getCredentialStatus,
  getCredentialSubject,
  getCredentialTypes,
  getCredentialValidity,
};
