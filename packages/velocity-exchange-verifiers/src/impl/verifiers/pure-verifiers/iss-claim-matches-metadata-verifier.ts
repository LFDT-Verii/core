/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { W3CCredentialJwtV1, Verifier, ERROR_CODES } from 'api/types';
import { buildError } from 'impl/errors';

/**
 * Verifies that the Credential JWT's `iss` claim exactly matches the expected issuer metadata.
 *
 * @remarks
 * This verifier enforces the Velocity Profile Conformance requirement that
 * `credential.payload.iss` must strictly equal `credential_issuer_metadata.iss`.
 *
 * Unlike the OpenID4VCI fallback behavior, this rule does **not** permit matching against
 * `credential_issuer_metadata.credential_issuer`.
 *
 * @param credential - A parsed {@link W3CCredentialJwtV1} object.
 * @param context - The {@link VerificationContext} containing expected issuer metadata and optional path.
 *
 * @returns A {@link VerificationError} if the `iss` does not match, or `null` if valid.
 *
 * @example
 * ```ts
 * const error = issClaimMatchesMetadataVerifier(credentialJwt, context);
 * if (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @validationRule `credential.payload.iss` must exactly equal `credential_issuer_metadata.iss`.
 * @errorCode `UNEXPECTED_CREDENTIAL_PAYLOAD_ISS` — if `payload.iss` does not strictly match expected issuer.
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const issClaimMatchesMetadataVerifier: Verifier<W3CCredentialJwtV1> = (
  credential,
  context
) => {
  const actual = credential.payload.iss;
  const expected = context.credential_issuer_metadata?.iss;

  if (actual !== expected) {
    return buildError(
      ERROR_CODES.UNEXPECTED_CREDENTIAL_PAYLOAD_ISS,
      `Expected iss to be exactly '${expected}', but got '${actual}'`,
      [...(context.path ?? []), 'payload', 'iss']
    );
  }

  return null;
};
