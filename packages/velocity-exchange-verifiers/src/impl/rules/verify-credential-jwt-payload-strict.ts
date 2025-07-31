/* eslint-disable max-len */
/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  algIsSupportedVerifier,
  createVerifier,
  credentialSchemaVerifier,
  credentialStatusVerifier,
  kidClaimIsVelocityV2Verifier,
  subIsDidJwkOrCnfVerifier,
} from 'impl/verifiers/pure-verifiers';
import {
  CredentialVerifiers,
  VerificationContext,
  VerificationError,
  W3CCredentialJwtV1,
} from 'api/types';

/**
 * Verifies a Credential JWT payload using strict validation rules defined by both
 * the Velocity Profile and the OpenID4VCI specification.
 *
 * @remarks
 * This composite verifier applies multiple independent verifiers to enforce critical
 * constraints on the credential's structure and issuer claims. It validates the payload
 * with both Velocity-specific and spec-compliant fallback logic for maximum security
 * and interoperability.
 *
 * @details
 * The following validations are applied:
 * - `header.alg` is one of `ES256`, `ES256K`, or `RS256` via {@link algIsSupportedVerifier}.
 * - `payload.vc.credentialSchema` must be present via {@link credentialSchemaVerifier}.
 * - `payload.vc.credentialStatus` must be present via {@link credentialStatusVerifier}.
 * - `payload.iss` must satisfy both:
 *   - `issClaimMatchesMetadataVerifier`: strict match with `credential_issuer_metadata.iss`
 *   - `issClaimMatchesEitherMetadataOrCredentialIssuerVerifier`: match with `credential_issuer_metadata.iss`
 *     or `credential_issuer_metadata.credential_issuer`.
 * - `payload.kid` must begin with `did:velocity:v2` via {@link kidClaimIsVelocityV2Verifier}.
 * - Subject binding must be satisfied by either `payload.sub === "did:jwk"` or
 *   a present `payload.cnf`, enforced via {@link subIsDidJwkOrCnfVerifier}.
 *
 * @param credential - A parsed {@link W3CCredentialJwtV1} object including the header and payload.
 * @param context - A {@link VerificationContext} containing path information and issuer metadata.
 *
 * @returns An array of {@link VerificationError} objects. Returns an empty array if the credential is valid.
 *
 * @example
 * ```ts
 * const errors = verifyCredentialJwtPayloadStrict(credentialJwt, context);
 * if (errors.length > 0) {
 *   console.error("Validation failed:", errors);
 * }
 * ```
 *
 * @see {@link createVerifier}
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 */
export const verifyCredentialJwtPayloadStrict = (
  credential: W3CCredentialJwtV1,
  context: VerificationContext,
  verifiers: CredentialVerifiers
): VerificationError[] => {
  const composedVerifier = createVerifier<W3CCredentialJwtV1>([
    verifiers.algIsSupported,
    verifiers.credentialSchema,
    verifiers.credentialStatus,
    verifiers.issClaimMatchesEitherMetadataOrCredentialIssuer,
    verifiers.issClaimMatchesMetadata,
    verifiers.kidClaimIsVelocityV2,
    verifiers.subIsDidJwkOrCnf,
  ]);

  return composedVerifier(credential, context);
};
