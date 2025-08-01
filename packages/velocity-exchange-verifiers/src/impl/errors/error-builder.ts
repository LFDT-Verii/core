/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ErrorCode, VerificationError } from 'api/types';

/**
 * Creates a {@link VerificationError} with a given error code, message, and location path.
 *
 * @param code - A predefined {@link ERROR_CODES | error code} representing the type of validation failure.
 * @param message - A human-readable explanation describing the error condition.
 * @param path - An optional array of strings representing the JSON pointer path to the offending field.
 *   This path is useful for identifying the exact location of the error within nested credential structures.
 *
 * @returns A {@link VerificationError} object with a standardized shape suitable for reporting or logging.
 *
 * @remarks
 * This utility ensures consistency across all verifiers in how errors are constructed and reported.
 *
 * @example
 * ```ts
 * const error = buildError(ERROR_CODES.INVALID_ALG, "Unsupported algorithm", ["header", "alg"]);
 * ```
 *
 * @see {@link VerificationError}
 * @see {@link ERROR_CODES}
 */
export const buildError = (
  code: ErrorCode,
  message: string,
  path: (string | number)[] = []
): VerificationError => ({ code, message, path });
