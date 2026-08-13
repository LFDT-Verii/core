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
const { jwsVerify, jwtVerify } = require('./core');
const {
  V2CredentialModelViolationTypes,
  getV2CoreCredentialModelViolation,
  getVelocityV2CredentialModelViolation,
} = require('./v2-credential-model-validator');

const AlgorithmKeyProfiles = Object.freeze({
  ES256: Object.freeze({ crv: 'P-256', kty: 'EC' }),
  ES256K: Object.freeze({ crv: 'secp256k1', kty: 'EC' }),
  RS256: Object.freeze({ kty: 'RSA' }),
});

const CredentialVerificationErrorCodes = Object.freeze({
  ALGORITHM_KEY_MISMATCH: 'CREDENTIAL_ALGORITHM_KEY_MISMATCH',
  AUDIENCE_INVALID: 'CREDENTIAL_AUDIENCE_INVALID',
  CONTEXT_INVALID: 'CREDENTIAL_CONTEXT_INVALID',
  HEADER_INVALID: 'CREDENTIAL_HEADER_INVALID',
  KID_INVALID: 'CREDENTIAL_KID_INVALID',
  JWT_CLAIM_INVALID: 'CREDENTIAL_JWT_CLAIM_INVALID',
  KID_BINDING_INVALID: 'CREDENTIAL_KID_BINDING_INVALID',
  MODEL_INVALID: 'CREDENTIAL_MODEL_INVALID',
  PROFILE_INVALID: 'CREDENTIAL_PROFILE_INVALID',
  SELF_SIGNED_ISSUER_INVALID: 'CREDENTIAL_SELF_SIGNED_ISSUER_INVALID',
  SIGNATURE_INVALID: 'CREDENTIAL_SIGNATURE_INVALID',
  TOKEN_EXPIRED: 'CREDENTIAL_TOKEN_EXPIRED',
  TOKEN_NOT_ACTIVE: 'CREDENTIAL_TOKEN_NOT_ACTIVE',
  UNSUPPORTED_ALGORITHM: 'CREDENTIAL_UNSUPPORTED_ALGORITHM',
});

class CredentialVerificationError extends CredentialEnvelopeError {
  constructor(code, message) {
    super(code, message);
    this.name = 'CredentialVerificationError';
  }
}

const CredentialVerificationModes = Object.freeze({
  JWS: 'jws',
  LEGACY_JWT: 'legacy-jwt',
});

const CredentialVerificationProfiles = Object.freeze({
  VELOCITY_V2: 'velocity-vc-v2',
});

const CredentialVerificationStatuses = Object.freeze({
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NOT_CHECKED: 'NOT_CHECKED',
  PASS: 'PASS',
});

const CredentialVerificationWarningCodes = Object.freeze({
  AUDIENCE_NOT_EVALUATED: 'CREDENTIAL_AUDIENCE_NOT_EVALUATED',
  CTY_NOT_RECOMMENDED: 'CREDENTIAL_CTY_NOT_RECOMMENDED',
  ISSUER_CLAIM_MISMATCH: 'CREDENTIAL_ISSUER_CLAIM_MISMATCH',
  JTI_ID_MISMATCH: 'CREDENTIAL_JTI_ID_MISMATCH',
  NBF_NOT_RECOMMENDED: 'CREDENTIAL_NBF_NOT_RECOMMENDED',
  SUBJECT_ID_MISMATCH: 'CREDENTIAL_SUBJECT_ID_MISMATCH',
  TYP_MISSING: 'CREDENTIAL_TYP_MISSING',
  TYP_NOT_RECOMMENDED: 'CREDENTIAL_TYP_NOT_RECOMMENDED',
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

const DEFAULT_CLOCK_TOLERANCE_MILLISECONDS = 120000;
const MAX_KID_CHARACTERS = 2048;

const assertCredentialVerificationAccepted = (result) => {
  if (!isCredentialVerificationAccepted(result)) {
    throw verificationErrorFrom(result);
  }
  return result;
};

const isCredentialVerificationAccepted = (result) =>
  result?.proof?.status === CredentialVerificationStatuses.PASS &&
  isPassingGate(result.conformance) &&
  isPassingGate(result.policy);

const verifyCredentialEnvelope = (compact, verificationKey, options = {}) =>
  verifyCredentialEnvelopeWithOptions(compact, verificationKey, options);

const verifyCredentialEnvelopeWithOptions = async (
  compact,
  verificationKey,
  options,
) => {
  const { audience, clockToleranceMilliseconds, currentTime, mode } =
    verificationOptionsFrom(options);
  assertVerificationMode(mode);
  const envelope = decodeCredentialEnvelope(compact);
  const resolvedVerificationKey = legacyJwtKey(envelope, verificationKey, mode);
  const proof = await verifyCredentialProof(
    envelope,
    resolvedVerificationKey,
    mode,
  );

  if (proof.status !== CredentialVerificationStatuses.PASS) {
    return buildVerificationResult(envelope, {
      conformance: notCheckedAssessment(),
      policy: notCheckedAssessment(),
      proof,
    });
  }

  const conformance = assessCredentialConformance(envelope);
  const policy = assessCredentialPolicy(envelope, conformance, {
    audience,
    clockToleranceMilliseconds,
    currentTime,
  });

  return buildVerificationResult(envelope, {
    conformance,
    policy,
    proof,
  });
};

const assessCredentialConformance = (envelope) => {
  if (envelope.dataModelVersion === CredentialDataModelVersions.V1_1) {
    return notApplicableAssessment();
  }

  const { credential, protectedHeader } = envelope;
  const modelViolation = getV2CoreCredentialModelViolation(credential);
  const errors = [
    ...errorsFromModelViolation(modelViolation),
    ...headerErrors(protectedHeader),
    ...jwtClaimErrors(credential),
    ...selfSignedIssuerErrors(credential.issuer, protectedHeader.kid),
  ];
  const warnings = [
    ...headerWarnings(protectedHeader),
    ...issuerClaimWarnings(credential),
    ...jwtClaimWarnings(credential),
  ];

  return assessmentFrom(errors, warnings);
};

const assessCredentialPolicy = (
  envelope,
  conformance,
  { audience, clockToleranceMilliseconds, currentTime },
) => {
  if (envelope.dataModelVersion === CredentialDataModelVersions.V1_1) {
    return notApplicableAssessment();
  }
  if (conformance.status !== CredentialVerificationStatuses.PASS) {
    return {
      ...notCheckedAssessment(),
      profile: CredentialVerificationProfiles.VELOCITY_V2,
    };
  }

  const profileViolation = getVelocityV2CredentialModelViolation(
    envelope.credential,
  );
  const { errors: jwtErrors, warnings } = jwtPolicyIssues(envelope.credential, {
    audience,
    clockToleranceMilliseconds,
    currentTime,
  });
  const errors = [
    ...errorsFromProfileViolation(profileViolation),
    ...jwtErrors,
  ];

  return {
    ...assessmentFrom(errors, warnings),
    profile: CredentialVerificationProfiles.VELOCITY_V2,
  };
};

const assessmentFrom = (errors, warnings) => ({
  errors,
  status:
    errors.length === 0
      ? CredentialVerificationStatuses.PASS
      : CredentialVerificationStatuses.FAIL,
  warnings,
});

const assertAlgorithmKeyMatch = (algorithm, jwk) => {
  const expectedKey = AlgorithmKeyProfiles[algorithm];
  if (!isJsonObject(jwk) || !isExpectedKey(jwk, expectedKey)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
      `Credential algorithm ${algorithm} does not match the resolved JWK`,
    );
  }
};

const assertProtectedAlgorithm = ({ dataModelVersion, protectedHeader }) => {
  const allowedAlgorithms = VersionAlgorithmAllowlists[dataModelVersion];
  if (!allowedAlgorithms.includes(protectedHeader.alg)) {
    throw new CredentialVerificationError(
      CredentialVerificationErrorCodes.UNSUPPORTED_ALGORITHM,
      `Credential algorithm ${protectedHeader.alg} is not allowed for VC ${dataModelVersion}`,
    );
  }
};

const assertVerificationMode = (verificationMode) => {
  if (!Object.values(CredentialVerificationModes).includes(verificationMode)) {
    throw new TypeError('Unsupported credential verification mode');
  }
};

const audienceMatches = (actual, expected) => {
  const actualValues = Array.isArray(actual) ? actual : [actual];
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return actualValues.some((value) => expectedValues.includes(value));
};

const buildVerificationResult = (envelope, { conformance, policy, proof }) => {
  const result = {
    ...envelope,
    conformance,
    policy,
    proof,
    signingAlgorithm: envelope.protectedHeader.alg,
  };

  return {
    ...result,
    credential: isCredentialVerificationAccepted(result)
      ? envelope.credential
      : null,
  };
};

const credentialSubjectIds = (credentialSubject) => {
  const subjects = Array.isArray(credentialSubject)
    ? credentialSubject
    : [credentialSubject];
  return subjects
    .map((subject) => subject?.id)
    .filter((id) => typeof id === 'string');
};

const errorsFromModelViolation = (violation) => {
  if (violation == null) {
    return [];
  }
  if (violation.type === V2CredentialModelViolationTypes.CONTEXT) {
    return [
      verificationIssue(CredentialVerificationErrorCodes.CONTEXT_INVALID),
    ];
  }
  return [
    verificationIssue(
      CredentialVerificationErrorCodes.MODEL_INVALID,
      violation.property,
    ),
  ];
};

const errorsFromProfileViolation = (violation) =>
  violation == null
    ? []
    : [
        verificationIssue(
          CredentialVerificationErrorCodes.PROFILE_INVALID,
          violation.property,
        ),
      ];

const headerErrors = (protectedHeader) =>
  [
    ctyError(protectedHeader),
    kidError(protectedHeader),
    typError(protectedHeader),
  ].filter(Boolean);

const ctyError = (protectedHeader) =>
  hasNonStringHeader(protectedHeader, 'cty')
    ? verificationIssue(CredentialVerificationErrorCodes.HEADER_INVALID, 'cty')
    : null;

const kidError = (protectedHeader) => {
  if (hasNonStringHeader(protectedHeader, 'kid')) {
    return verificationIssue(
      CredentialVerificationErrorCodes.KID_INVALID,
      'kid',
    );
  }
  const { kid } = protectedHeader;
  return typeof kid === 'string' &&
    (kid.length === 0 || kid.length > MAX_KID_CHARACTERS)
    ? verificationIssue(CredentialVerificationErrorCodes.KID_INVALID, 'kid')
    : null;
};

const typError = (protectedHeader) =>
  hasNonStringHeader(protectedHeader, 'typ')
    ? verificationIssue(CredentialVerificationErrorCodes.HEADER_INVALID, 'typ')
    : null;

const hasNonStringHeader = (protectedHeader, property) =>
  Object.hasOwn(protectedHeader, property) &&
  typeof protectedHeader[property] !== 'string';

const headerWarnings = (protectedHeader) => {
  const { cty, typ } = protectedHeader;
  const warnings = [];
  if (!Object.hasOwn(protectedHeader, 'typ')) {
    warnings.push(
      verificationIssue(CredentialVerificationWarningCodes.TYP_MISSING, 'typ'),
    );
  } else if (
    typeof typ === 'string' &&
    typ !== CredentialEnvelopeFormats.VC_JWT
  ) {
    warnings.push(
      verificationIssue(
        CredentialVerificationWarningCodes.TYP_NOT_RECOMMENDED,
        'typ',
      ),
    );
  }
  if (typeof cty === 'string' && cty !== 'vc') {
    warnings.push(
      verificationIssue(
        CredentialVerificationWarningCodes.CTY_NOT_RECOMMENDED,
        'cty',
      ),
    );
  }
  return warnings;
};

const isAudience = (audience) =>
  typeof audience === 'string' ||
  (Array.isArray(audience) &&
    audience.length > 0 &&
    audience.every((value) => typeof value === 'string'));

const isExpectedKey = (jwk, expectedKey) => {
  if (jwk.kty !== expectedKey?.kty) {
    return false;
  }
  return expectedKey.crv == null
    ? jwk.crv == null
    : jwk.crv === expectedKey.crv;
};

const isJsonObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const isNumericDate = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const isPassingGate = (assessment) =>
  [
    CredentialVerificationStatuses.NOT_APPLICABLE,
    CredentialVerificationStatuses.PASS,
  ].includes(assessment?.status);

const jwtClaimErrors = (credential) => [
  ...issuerClaimErrors(credential),
  ...stringClaimErrors(credential),
  ...numericDateClaimErrors(credential),
  ...audienceClaimErrors(credential),
];

const issuerClaimErrors = (credential) => {
  if (!Object.hasOwn(credential, 'iss') || typeof credential.iss === 'string') {
    return [];
  }
  return [
    verificationIssue(
      CredentialVerificationErrorCodes.JWT_CLAIM_INVALID,
      'iss',
    ),
  ];
};

const issuerClaimWarnings = (credential) =>
  typeof credential.iss === 'string' &&
  credential.iss !== issuerIdFrom(credential.issuer)
    ? [
        verificationIssue(
          CredentialVerificationWarningCodes.ISSUER_CLAIM_MISMATCH,
          'iss',
        ),
      ]
    : [];

const stringClaimErrors = (credential) =>
  ['jti', 'sub'].flatMap((property) =>
    Object.hasOwn(credential, property) &&
    typeof credential[property] !== 'string'
      ? [
          verificationIssue(
            CredentialVerificationErrorCodes.JWT_CLAIM_INVALID,
            property,
          ),
        ]
      : [],
  );

const numericDateClaimErrors = (credential) =>
  ['exp', 'iat', 'nbf'].flatMap((property) =>
    Object.hasOwn(credential, property) && !isNumericDate(credential[property])
      ? [
          verificationIssue(
            CredentialVerificationErrorCodes.JWT_CLAIM_INVALID,
            property,
          ),
        ]
      : [],
  );

const audienceClaimErrors = (credential) =>
  Object.hasOwn(credential, 'aud') && !isAudience(credential.aud)
    ? [
        verificationIssue(
          CredentialVerificationErrorCodes.JWT_CLAIM_INVALID,
          'aud',
        ),
      ]
    : [];

const jwtClaimWarnings = (credential) => [
  ...jtiWarnings(credential),
  ...subjectWarnings(credential),
  ...notBeforeWarnings(credential),
];

const jtiWarnings = (credential) =>
  typeof credential.jti === 'string' &&
  typeof credential.id === 'string' &&
  credential.jti !== credential.id
    ? [
        verificationIssue(
          CredentialVerificationWarningCodes.JTI_ID_MISMATCH,
          'jti',
        ),
      ]
    : [];

const subjectWarnings = (credential) => {
  const subjectIds = credentialSubjectIds(credential.credentialSubject);
  if (
    typeof credential.sub !== 'string' ||
    subjectIds.length === 0 ||
    subjectIds.includes(credential.sub)
  ) {
    return [];
  }
  return [
    verificationIssue(
      CredentialVerificationWarningCodes.SUBJECT_ID_MISMATCH,
      'sub',
    ),
  ];
};

const notBeforeWarnings = (credential) =>
  isNumericDate(credential.nbf)
    ? [
        verificationIssue(
          CredentialVerificationWarningCodes.NBF_NOT_RECOMMENDED,
          'nbf',
        ),
      ]
    : [];

const jwtPolicyIssues = (credential, options) => {
  const errors = [
    ...expirationErrors(credential, options),
    ...notBeforeErrors(credential, options),
    ...audienceErrors(credential, options.audience),
  ];
  return {
    errors,
    warnings: audienceWarnings(credential, options.audience),
  };
};

const expirationErrors = (
  credential,
  { clockToleranceMilliseconds, currentTime },
) =>
  isNumericDate(credential.exp) &&
  currentTime - clockToleranceMilliseconds >= credential.exp * 1000
    ? [verificationIssue(CredentialVerificationErrorCodes.TOKEN_EXPIRED, 'exp')]
    : [];

const notBeforeErrors = (
  credential,
  { clockToleranceMilliseconds, currentTime },
) =>
  isNumericDate(credential.nbf) &&
  currentTime + clockToleranceMilliseconds < credential.nbf * 1000
    ? [
        verificationIssue(
          CredentialVerificationErrorCodes.TOKEN_NOT_ACTIVE,
          'nbf',
        ),
      ]
    : [];

const audienceErrors = (credential, audience) =>
  audience != null && !audienceMatches(credential.aud, audience)
    ? [
        verificationIssue(
          CredentialVerificationErrorCodes.AUDIENCE_INVALID,
          'aud',
        ),
      ]
    : [];

const audienceWarnings = (credential, audience) =>
  audience == null && credential.aud != null
    ? [
        verificationIssue(
          CredentialVerificationWarningCodes.AUDIENCE_NOT_EVALUATED,
          'aud',
        ),
      ]
    : [];

const verificationOptionsFrom = ({
  audience,
  clockToleranceMilliseconds = DEFAULT_CLOCK_TOLERANCE_MILLISECONDS,
  currentTime = Date.now(),
  mode = CredentialVerificationModes.JWS,
}) => ({ audience, clockToleranceMilliseconds, currentTime, mode });

const legacyJwtKey = (envelope, verificationKey, mode) =>
  mode === CredentialVerificationModes.LEGACY_JWT
    ? (verificationKey ?? envelope.protectedHeader.jwk)
    : verificationKey;

const issuerIdFrom = (issuer) =>
  typeof issuer === 'string' ? issuer : issuer?.id;

const notApplicableAssessment = () => ({
  errors: [],
  status: CredentialVerificationStatuses.NOT_APPLICABLE,
  warnings: [],
});

const notCheckedAssessment = () => ({
  errors: [],
  status: CredentialVerificationStatuses.NOT_CHECKED,
  warnings: [],
});

const selfSignedIssuerErrors = (issuer, kid) => {
  if (typeof kid !== 'string') {
    return [];
  }
  const keyController = kid.split('#')[0];
  if (!keyController.startsWith('did:jwk:')) {
    return [];
  }
  return issuerIdFrom(issuer) === keyController
    ? []
    : [
        verificationIssue(
          CredentialVerificationErrorCodes.SELF_SIGNED_ISSUER_INVALID,
          'kid',
        ),
      ];
};

const verificationErrorFrom = (result) => {
  const assessments = [
    result?.proof,
    result?.conformance,
    result?.policy,
  ].filter(Boolean);
  const firstIssue = assessments.flatMap(({ errors }) => errors)[0];
  const code =
    firstIssue?.code ?? CredentialVerificationErrorCodes.SIGNATURE_INVALID;
  return new CredentialVerificationError(code, verificationMessageFrom(code));
};

const verificationIssue = (code, property) => ({
  code,
  ...(property == null ? {} : { property }),
});

const verificationMessageFrom = (code) => {
  if (code === CredentialVerificationErrorCodes.SIGNATURE_INVALID) {
    return 'signature verification failed';
  }
  if (code === CredentialVerificationErrorCodes.CONTEXT_INVALID) {
    return 'VC 2.0 contexts are invalid';
  }
  if (code === CredentialVerificationErrorCodes.PROFILE_INVALID) {
    return 'VC 2.0 credential does not satisfy the Velocity profile';
  }
  return 'credential verification failed';
};

const verifyCompact = (compact, verificationKey, verificationMode) =>
  verificationMode === CredentialVerificationModes.LEGACY_JWT
    ? jwtVerify(compact, verificationKey)
    : jwsVerify(compact, verificationKey);

const verifyCredentialProof = async (
  envelope,
  verificationKey,
  verificationMode,
) => {
  try {
    assertProtectedAlgorithm(envelope);
    assertAlgorithmKeyMatch(envelope.protectedHeader.alg, verificationKey);
    await verifyCompact(envelope.compact, verificationKey, verificationMode);
    return {
      errors: [],
      status: CredentialVerificationStatuses.PASS,
    };
  } catch (error) {
    return {
      errors: [
        verificationIssue(
          error instanceof CredentialVerificationError
            ? error.code
            : CredentialVerificationErrorCodes.SIGNATURE_INVALID,
        ),
      ],
      status: CredentialVerificationStatuses.FAIL,
    };
  }
};

module.exports = {
  AlgorithmKeyProfiles,
  CredentialVerificationError,
  CredentialVerificationErrorCodes,
  CredentialVerificationModes,
  CredentialVerificationProfiles,
  CredentialVerificationStatuses,
  CredentialVerificationWarningCodes,
  VersionAlgorithmAllowlists,
  assertCredentialVerificationAccepted,
  isCredentialVerificationAccepted,
  verifyCredentialEnvelope,
};
