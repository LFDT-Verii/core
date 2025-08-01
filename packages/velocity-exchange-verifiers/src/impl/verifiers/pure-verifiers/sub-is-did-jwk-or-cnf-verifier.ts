/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { W3CCredentialJwtV1, Verifier, ERROR_CODES } from 'api/types';
import { buildError } from 'impl/errors';

/**
 * Verifies that the Credential JWT payload includes a valid subject declaration using either `sub` or `cnf`.
 *
 * @remarks
 * According to the OpenID for Verifiable Credential Issuance (OpenID4VCI) specification and the Velocity profile,
 * a credential must express subject binding via either:
 *
 * - A `sub` (subject) claim with the exact value `"did:jwk"`, or
 * - A `cnf` (confirmation) object containing key binding information.
 *
 * This verifier enforces that at least one of these identity mechanisms is present.
 *
 * @param credential - The parsed {@link W3CCredentialJwtV1} to validate.
 * @param context - A {@link VerificationContext} object, used to trace the source of the error.
 *
 * @returns A {@link VerificationError} if the validation fails, or `null` if the credential is valid.
 *
 * @example
 * ```ts
 * const error = subIsDidJwkOrCnfVerifier(credentialJwt, verificationContext);
 * if (error) {
 *   handle(error);
 * }
 * ```
 *
 * @validationRule `payload.sub` must equal `"did:jwk"` **or** `payload.cnf` must be present.
 * @errorCode `SUB_OR_CNF_MISSING` — if both are missing or invalid.
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const subIsDidJwkOrCnfVerifier: Verifier<W3CCredentialJwtV1> = (
  credential,
  context
) => {
  const sub = credential.payload?.sub;
  const cnf = credential.payload?.cnf;

  if (sub !== 'did:jwk' && !cnf) {
    return buildError(
      ERROR_CODES.SUB_OR_CNF_MISSING,
      `Expected sub to be 'did:jwk' or cnf to be present. Got sub=${sub}, cnf=${JSON.stringify(
        cnf
      )}`,
      [...(context.path ?? []), 'payload']
    );
  }

  return null;
};
