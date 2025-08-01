/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { buildError } from 'impl/errors';
import { W3CCredentialJwtV1, Verifier, ERROR_CODES } from 'api/types';

/**
 * Verifies that the `vc.credentialSchema` field exists in the Credential JWT payload.
 *
 * @remarks
 * This verifier ensures that the `credentialSchema` property is present inside the Verifiable Credential (VC)
 * object located within the payload. This is a mandatory requirement for conformance with the Velocity Profile.
 * If missing, the credential is considered invalid under profile rules.
 *
 * @param credential - The {@link W3CCredentialJwtV1} object containing both `header` and `payload`.
 * @param context - The {@link VerificationContext} used for error path tracking and metadata access.
 *
 * @returns A {@link VerificationError} if the field is missing, or `null` if the credential is valid.
 *
 * @example
 * ```ts
 * const error = credentialSchemaVerifier(credentialJwt, verificationContext);
 * if (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @validationRule `credential.payload.vc.credentialSchema` must be defined.
 * @errorCode `MISSING_CREDENTIAL_SCHEMA` — if `payload.vc.credentialSchema` is missing.
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const credentialSchemaVerifier: Verifier<W3CCredentialJwtV1> = (
  credential,
  context
) => {
  return credential.payload?.vc?.credentialSchema == null
    ? buildError(
        ERROR_CODES.MISSING_CREDENTIAL_SCHEMA,
        'Expected credentialSchema in payload.vc.credentialSchema, but got undefined',
        [...(context.path ?? []), 'payload', 'vc', 'credentialSchema']
      )
    : null;
};
