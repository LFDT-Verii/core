/**
 * Created by Michael Avoyan on 22/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { VerificationContext } from 'api/types';

/**
 * Appends a nested path segment to an existing {@link VerificationContext}.
 *
 * This utility is used during recursive validation to track the exact location
 * of a field or value within a nested JSON structure (e.g., a Verifiable Credential).
 * It ensures that each verifier can report precise and traceable error locations.
 *
 * The resulting `context.path` is composed by appending `pathExtension` to the
 * existing `context.path`, if any. This supports both object and array navigation.
 *
 * ### Example
 * ```ts
 * const baseContext: VerificationContext = { path: ['credentials', 0] };
 * const extended = withPath(baseContext, ['payload', 'vc', 'credentialSchema']);
 * console.log(extended.path); // ['credentials', 0, 'payload', 'vc', 'credentialSchema']
 * ```
 *
 * @param context - The original validation context to extend
 * @param pathExtension - A list of keys or indices to append to the existing path
 * @returns A new {@link VerificationContext} with the extended path
 *
 * @see {@link VerificationContext}
 */
export const withPath = (
  context: VerificationContext,
  pathExtension: (string | number)[]
): VerificationContext => ({
  ...context,
  path: [...(context.path ?? []), ...pathExtension],
});
