/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  W3CCredentialJwtV1,
  Verifier,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';
import { buildError } from 'impl/errors';

/**
 * Verifies that the Credential JWT's `iss` claim matches the expected issuer metadata.
 *
 * @remarks
 * This verifier implements the OpenID4VCI specification fallback behavior by validating that
 * the `payload.iss` field in the Credential JWT matches **either**:
 *
 * - `credential_issuer_metadata.iss`
 * - `credential_issuer_metadata.credential_issuer`
 *
 * This ensures conformance with OpenID4VCI while enabling broader ecosystem compatibility.
 *
 * @param credential - A parsed {@link W3CCredentialJwtV1} object.
 * @param context - The {@link VerificationContext} containing issuer metadata and optional path.
 *
 * @returns A {@link VerificationError} if validation fails, or `null` if valid.
 *
 * @example
 * ```ts
 * const error = issClaimMatchesEitherMetadataOrCredentialIssuerVerifier(credentialJwt, context);
 * if (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @validationRule `credential.payload.iss` must equal `credential_issuer_metadata.iss` or `credential_issuer_metadata.credential_issuer`.
 * @errorCode `UNEXPECTED_CREDENTIAL_PAYLOAD_ISS` — if the issuer does not match either expected value.
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const issClaimMatchesEitherMetadataOrCredentialIssuerVerifier: Verifier<
  W3CCredentialJwtV1
> = (credential, context) => {
  const { payload } = credential;
  const credentialIssuerMetadata = context.credential_issuer_metadata;

  const allowedValues = [
    credentialIssuerMetadata?.iss,
    credentialIssuerMetadata?.credential_issuer,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  if (
    typeof payload?.iss !== 'string' ||
    !allowedValues.includes(payload.iss)
  ) {
    return buildError(
      ERROR_CODES.UNEXPECTED_CREDENTIAL_PAYLOAD_ISS,
      `Expected iss to be one of [${allowedValues.join(', ')}], but got '${
        payload?.iss
      }'`,
      [...(context.path ?? []), 'payload', 'iss']
    );
  }

  return null;
};
