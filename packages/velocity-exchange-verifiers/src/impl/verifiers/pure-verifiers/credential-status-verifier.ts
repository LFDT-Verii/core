/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildError } from 'impl/errors';
import { W3CCredentialJwtV1, Verifier, ERROR_CODES } from 'api/types';

/**
 * Verifies that the `vc.credentialStatus` field exists in the Credential JWT payload.
 *
 * @remarks
 * This verifier ensures that the `credentialStatus` property is present within the Verifiable Credential (VC)
 * section of the JWT payload. This field is critical for enabling status checks like revocation or suspension,
 * and is required by the Velocity Profile conformance rules.
 *
 * @param credential - The {@link W3CCredentialJwtV1} object containing both `header` and `payload`.
 * @param context - The {@link VerificationContext} used for issuer metadata and error path tracking.
 *
 * @returns A {@link VerificationError} with a single entry if the field is missing,
 * or `null` if the credential is valid.
 *
 * @example
 * ```ts
 * const error = credentialStatusVerifier(credentialJwt, verificationContext);
 * if (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @validationRule `credential.payload.vc.credentialStatus` must be defined.
 * @errorCode `MISSING_CREDENTIAL_STATUS` — if `vc.credentialStatus` is missing.
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const credentialStatusVerifier: Verifier<W3CCredentialJwtV1> = (
  credential,
  context
) => {
  const path = [...(context.path ?? []), 'payload', 'vc', 'credentialStatus'];

  return credential.payload?.vc?.credentialStatus == null
    ? buildError(
        ERROR_CODES.MISSING_CREDENTIAL_STATUS,
        `Expected vc.credentialStatus to exist at path: ${path.join('.')}`,
        path
      )
    : null;
};
