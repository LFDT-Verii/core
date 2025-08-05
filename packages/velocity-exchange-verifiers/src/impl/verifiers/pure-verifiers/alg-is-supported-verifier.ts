/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { W3CCredentialJwtV1, Verifier, ERROR_CODES } from 'api/types';
import { buildError } from 'impl/errors';

/**
 * Verifies that the JWT's `header.alg` value is one of the supported algorithms.
 *
 * @remarks
 * This verifier ensures that the credential is signed using an approved algorithm,
 * as required by the Velocity profile and JOSE (JSON Object Signing and Encryption) standards.
 *
 * Supported algorithms are:
 * - `ES256`
 * - `ES256K`
 * - `RS256`
 *
 * If the `alg` value is missing or does not match one of the supported algorithms, a
 * {@link VerificationError} with the code `INVALID_ALG` will be returned.
 *
 * @param credential - The {@link W3CCredentialJwtV1} object, including the JOSE header and payload.
 * @param context - The {@link VerificationContext}, used for tracking the path of the validated field.
 * @returns A {@link VerificationError} if validation fails, or `null` if the algorithm is supported.
 *
 * @example
 * ```ts
 * const error = algIsSupportedVerifier(credentialJwt, verificationContext);
 * if (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @see {@link W3CCredentialJwtV1}
 * @see {@link VerificationError}
 */
export const algIsSupportedVerifier: Verifier<W3CCredentialJwtV1> = (
  credential,
  context
) => {
  const { alg } = credential.header;
  if (!supportedAlgs.includes(alg)) {
    return buildError(ERROR_CODES.INVALID_ALG, `Unsupported alg: '${alg}'`, [
      ...(context.path ?? []),
      'header',
      'alg',
    ]);
  }
  return null;
};

const supportedAlgs = ['ES256', 'ES256K', 'RS256'];
