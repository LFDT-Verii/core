/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VerificationError,
  VerificationContext,
  W3CCredentialJwtV1,
  CredentialEndpointResponse,
  CredentialVerifiers,
} from 'api/types';
import { verifyCredentialJwtPayloadStrict } from 'impl/rules';
import { withPath } from 'impl/utils';
import {
  algIsSupportedVerifier,
  credentialSchemaVerifier,
  credentialStatusVerifier,
  issClaimMatchesEitherMetadataOrCredentialIssuerVerifier,
  issClaimMatchesMetadataVerifier,
  kidClaimIsVelocityV2Verifier,
  subIsDidJwkOrCnfVerifier,
} from 'impl/verifiers/pure-verifiers';

/**
 * Verifies the structure and contents of a Credential Endpoint response according to the Velocity Profile.
 *
 * @param response - The object returned by the Credential Issuer's Credential Endpoint.
 * @param context - Contextual data including issuer metadata and error path tracking.
 * @param verifiers - A set of credential-level verifiers to apply (defaults to the Velocity Profile).
 * @returns A flat array of {@link VerificationError} objects representing validation issues.
 *
 * @remarks
 * This validator is intended for use in **immediate issuance flows** as defined by the
 * OpenID for Verifiable Credential Issuance (OpenID4VCI) specification.
 *
 * Each credential in `response.credentials` is validated independently using
 * {@link verifyCredentialJwtPayloadStrict}, which applies a strict set of checks, including:
 *
 * - Signature algorithm support (`alg`)
 * - Issuer consistency (`iss`)
 * - Key identifier prefix (`kid`)
 * - Subject binding (`sub` or `cnf`)
 * - Presence of `vc.credentialSchema`
 * - Presence of `vc.credentialStatus`
 *
 * @remarks
 * - If `response.credentials` is `null`, `undefined`, or an empty array, the function returns an empty list.
 * - `notification_id` is currently ignored. (TODO)
 * - Deferred issuance flows (`transaction_id`, `interval`) are not supported and must be handled elsewhere.
 *
 * @example
 * ```ts
 * const response = await fetchCredentialResponse();
 * const errors = verifyCredentialEndpointResponse(response, verificationContext);
 *
 * if (errors.length > 0) {
 *   logAndReject(errors);
 * }
 * ```
 *
 * @see {@link verifyCredentialJwtPayloadStrict}
 * @see {@link VerificationError}
 * @see {@link VerificationContext}
 */
export const verifyCredentialEndpointResponse = (
  response: CredentialEndpointResponse,
  context: VerificationContext,
  verifiers: CredentialVerifiers = defaultCredentialVerifiers
): VerificationError[] => {
  const credentials = response.credentials ?? [];

  return credentials.flatMap((credential: W3CCredentialJwtV1, i: number) =>
    verifyCredentialJwtPayloadStrict(
      credential,
      withPath(context, ['credentials', i]),
      verifiers
    )
  );
};

/**
 * The default set of verifiers applied to each credential under the Velocity Profile.
 */
export const defaultCredentialVerifiers: CredentialVerifiers = {
  algIsSupported: algIsSupportedVerifier,
  credentialSchema: credentialSchemaVerifier,
  credentialStatus: credentialStatusVerifier,
  issClaimMatchesEitherMetadataOrCredentialIssuer:
    issClaimMatchesEitherMetadataOrCredentialIssuerVerifier,
  issClaimMatchesMetadata: issClaimMatchesMetadataVerifier,
  kidClaimIsVelocityV2: kidClaimIsVelocityV2Verifier,
  subIsDidJwkOrCnf: subIsDidJwkOrCnfVerifier,
};
