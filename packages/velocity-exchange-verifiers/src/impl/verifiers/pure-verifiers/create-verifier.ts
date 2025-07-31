/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { VerificationError, Verifier } from 'api/types';

/**
 * Creates a compound verifier by composing multiple single-purpose verifiers.
 *
 * @remarks
 * This function enables declarative validation by combining multiple reusable {@link Verifier} functions
 * into a single pipeline. Each verifier is applied to the same `value` and `context`, and any
 * resulting {@link VerificationError} objects are collected into a single array.
 *
 * This utility is useful for building modular, maintainable validation logic.
 *
 * @typeParam T - The type of data being validated (e.g., a parsed {@link CredentialJwt}).
 *
 * @param rules - An array of {@link Verifier} functions to apply in order.
 * @returns A {@link Verifier} that applies all provided rules and returns a combined list of validation errors.
 *
 * @example
 * ```ts
 * const myVerifier = createVerifier([
 *   issClaimMatchesMetadataVerifier,
 *   kidClaimIsVelocityV2Verifier,
 *   algIsSupportedVerifier
 * ]);
 *
 * const errors = myVerifier(credentialJwt, context);
 * if (errors.length > 0) {
 *   console.error("Validation failed:", errors);
 * }
 * ```
 *
 * @see {@link Verifier}
 * @see {@link VerificationError}
 */
export const createVerifier =
  <T>(
    rules: Verifier<T>[]
  ): ((value: T, context: any) => VerificationError[]) =>
  (value, context) => {
    return rules
      .map((rule) => rule(value, context))
      .filter((err): err is VerificationError => err != null);
  };
