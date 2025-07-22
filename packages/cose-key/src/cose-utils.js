/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Code snippet inspired by: https://github.com/ldclabs/cose-ts

// TODO convert to use ESM directly and remove the async from all cbor code and clients

/**
 * Decodes a CBOR-encoded Uint8Array into a JavaScript value.
 *
 * @template T
 * @param {Uint8Array} data - The CBOR-encoded data to decode.
 * @returns {T} The decoded JavaScript value.
 * @throws {Error} If decoding fails or duplicate keys are encountered.
 */
const decodeCBOR = async (data) => {
  const { decode } = await import('cborg');
  return decode(data, {
    useMaps: true,
    rejectDuplicateMapKeys: true,
  });
};

/**
 * Encodes a JavaScript value into CBOR format.
 *
 * @param {unknown} data - The JavaScript value to encode (e.g., Map, Array, Object).
 * @returns {Uint8Array} The CBOR-encoded result.
 */
const encodeCBOR = async (data) => {
  const { encode } = await import('cborg');
  return encode(data, {});
};

module.exports = { decodeCBOR, encodeCBOR };
