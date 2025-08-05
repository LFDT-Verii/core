/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A structured group of verifiers used for validating a W3C Credential JWT under the Velocity Profile.
 *
 * Each verifier enforces a distinct validation rule on the credential, such as checking required fields,
 * cryptographic algorithm support, issuer consistency, and schema conformance.
 *
 * This type allows verifiers to be injected for testing or customized validation behavior.
 */
export interface CredentialVerifiers {
  algIsSupported: Verifier<W3CCredentialJwtV1>;
  credentialSchema: Verifier<W3CCredentialJwtV1>;
  credentialStatus: Verifier<W3CCredentialJwtV1>;
  issClaimMatchesEitherMetadataOrCredentialIssuer: Verifier<W3CCredentialJwtV1>;
  issClaimMatchesMetadata: Verifier<W3CCredentialJwtV1>;
  kidClaimIsVelocityV2: Verifier<W3CCredentialJwtV1>;
  subIsDidJwkOrCnf: Verifier<W3CCredentialJwtV1>;
}

/**
 * @packageDocumentation
 * This module defines core types used in the Verifiable Credential (VC) verification framework
 * for the OpenID for Verifiable Credential Issuance (OpenID4VCI) protocol and the Velocity Profile.
 *
 * These types are used to implement a rule-based, composable verification pipeline for verifying
 * Credential JWTs, issuer metadata, and response objects. Each verifier produces structured
 * verification errors with traceable paths.
 *
 * @remarks
 * - `Verifier<T>` defines a reusable verification rule for a given type.
 * - `CredentialIssuerMetadata` describes issuer metadata retrieved during discovery.
 * - `VerificationContext` provides shared metadata and state for all verifiers.
 * - `VerificationError` captures a single verification rule failure.
 * - `CredentialJwt` represents a parsed JWT in the VC issuance flow.
 */

/**
 * Defines a reusable verification function that checks a value against one or more rules.
 *
 * A `Verifier<T>` is a pure function that receives the input value and a shared
 * `VerificationContext`, and returns an array of `VerificationError` object
 * describing any detected issue.
 *
 * @template T - The input type to verify (e.g., `CredentialJwt`)
 */
export type Verifier<T> = (
  value: T,
  context: VerificationContext
) => VerificationError | null;

/**
 * Describes metadata about a credential issuer, typically retrieved from
 * the `.well-known/openid-credential-issuer` endpoint.
 *
 * This metadata is used during credential verification to verify issuer claims.
 */
export type CredentialIssuerMetadata = {
  /**
   * Primary issuer identifier expected to match the `iss` claim in credentials.
   */
  iss: string;

  /**
   * Optional fallback identifier used for OpenID4VCI compatibility.
   */
  credential_issuer?: string;
};

/**
 * Shared context passed to all verifiers during credential or response verification.
 *
 * This includes issuer metadata, the full response (if needed), and a hierarchical path
 * used to generate precise error traces.
 */
export type VerificationContext = {
  /**
   * Issuer metadata used to verify `iss` claims in credentials.
   */
  credential_issuer_metadata?: CredentialIssuerMetadata;

  /**
   * Optional raw response object being verified, used by higher-level verifiers.
   */
  response?: unknown;

  /**
   * Optional path to the current value being verified, for error tracing.
   */
  path?: Array<string | number>;
};

/**
 * Represents a structured verification error produced by a verifier.
 *
 * Errors are designed to be machine-readable, traceable to a path,
 * and informative for debugging or user-facing feedback.
 */
export type VerificationError = {
  /**
   * A stable, machine-readable identifier for the verification rule that failed.
   */
  code: string;

  /**
   * A human-readable description of what went wrong.
   */
  message: string;

  /**
   * Optional JSON path to the offending value.
   */
  path?: Array<string | number>;
};

/**
 * Represents a parsed Credential JWT (JSON Web Token) used in VC issuance flows.
 *
 * This structure includes both the JOSE `header` and `payload` fields,
 * with strongly typed VC-relevant claims.
 */
export type W3CCredentialJwtV1 = {
  /**
   * JWT header fields, including the signing algorithm.
   */
  header: {
    /**
     * Optional Key ID; expected to start with `did:velocity:v2` under the Velocity Profile.
     */
    kid?: string;

    /**
     * The cryptographic algorithm used to sign the JWT (e.g., `ES256K`, `ES256`, `RS256`).
     */
    alg: string;

    /**
     * Additional JOSE header parameters.
     */
    [key: string]: unknown;
  };

  /**
   * JWT payload fields, including standard claims and VC-specific claims.
   */
  payload: {
    /**
     * The credential issuer's identifier, which must be verified against metadata.
     */
    iss: string;

    /**
     * Optional subject identifier; typically `"did:jwk"` for wallet-based credentials.
     */
    sub?: string;

    /**
     * Optional confirmation object for subject key binding (used when `sub` is not present).
     */
    cnf?: unknown;

    /**
     * Verifiable Credential object, including schema and status information.
     */
    vc: {
      /**
       * Credential schema definition URI or object. Required under the Velocity Profile.
       */
      credentialSchema?: unknown;

      /**
       * Credential status information (e.g., for revocation or suspension).
       */
      credentialStatus?: unknown;

      /**
       * Any additional Verifiable Credential fields.
       */
      [key: string]: unknown;
    };

    /**
     * Any additional JWT claims not explicitly modeled.
     */
    [key: string]: unknown;
  };
};

/**
 * Represents a response from the Credential Endpoint (OpenID4VCI).
 *
 * Typically includes a `credentials` array of {@link W3CCredentialJwtV1} entries, each expected to
 * conform to OpenID4VCI and Velocity validation rules.
 *
 * Additional fields may be present depending on the issuer.
 *
 * @example
 * const response: CredentialEndpointResponse = {
 *   credentials: [parsedCredentialJwt1, parsedCredentialJwt2]
 * };
 *
 * @see {@link W3CCredentialJwtV1}
 */
export type CredentialEndpointResponse = {
  credentials?: W3CCredentialJwtV1[];
  [key: string]: unknown;
};

/**
 * A constant object defining all supported error codes used by credential validation verifiers.
 *
 * @remarks
 * Each error code represents a specific type of validation failure.
 *
 * @example
 * ```ts
 * if (error.code === ERROR_CODES.MISSING_CREDENTIAL_SCHEMA) {
 *   // Handle missing schema case
 * }
 * ```
 *
 * @see {@link VerificationError.code}
 */
export const ERROR_CODES = {
  INVALID_ALG: 'invalid_alg',
  INVALID_KID: 'invalid_kid',
  SUB_OR_CNF_MISSING: 'sub_or_cnf_missing',
  UNEXPECTED_CREDENTIAL_PAYLOAD_ISS: 'unexpected_credential_payload_iss',
  UNEXPECTED_CREDENTIAL_ISSUER_METADATA:
    'unexpected_credential_credential_issuer_metadata',
  MISSING_CREDENTIAL_STATUS: 'missing_credential_status',
  MISSING_CREDENTIAL_SCHEMA: 'missing_credential_schema',
} as const;

/**
 * A strict union type of all known error code values from `ERROR_CODES`.
 *
 * Can be used to type-check the `code` field in a `VerificationError` object,
 * ensuring only known codes are allowed.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
