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
const { KeyParameters, KeyTypes, EC2KeyParameters } = require('./cose-iana');

const { decodeCBOR } = require('./cose-utils');

const { KVMap, assertBytes, assertIntOrText } = require('./kv-map');

/**
 * Interface for encryption/decryption.
 * @typedef {Object} Encryptor
 * @property {function(): number} nonceSize
 * @property {function(Uint8Array, Uint8Array, Uint8Array=): Promise<Uint8Array>} encrypt
 * @property {function(Uint8Array, Uint8Array, Uint8Array=): Promise<Uint8Array>} decrypt
 */

/**
 * Interface for MAC generation.
 * @typedef {Object} MACer
 * @property {function(Uint8Array): Uint8Array} mac
 */

/**
 * Interface for signing.
 * @typedef {Object} Signer
 * @property {function(Uint8Array): Uint8Array} sign
 */

/**
 * Interface for signature verification.
 * @typedef {Object} Verifier
 * @property {function(Uint8Array, Uint8Array): boolean} verify
 */

/**
 * Interface for ECDH key exchange.
 * @typedef {Object} ECDHer
 * @property {function(CoseKey): Uint8Array} ecdh
 */

/**
 * COSE CoseKey representation based on RFC9052 and RFC9053.
 * @see https://datatracker.ietf.org/doc/html/rfc9052
 * @see https://datatracker.ietf.org/doc/html/rfc9053
 */
class CoseKey extends KVMap {
  /**
   * Decode a CoseKey from CBOR bytes.
   * @param {Uint8Array} data
   * @returns {Promise<CoseKey>}
   */
  static async fromBytes(data) {
    return new CoseKey(await decodeCBOR(data));
  }

  /**
   * @param {Map<any, any>} [kv=new Map()]
   */
  constructor(kv = new Map()) {
    super(kv);
  }

  /** @returns {number|string} */
  get kty() {
    return this.getType(KeyParameters.Kty, assertIntOrText, 'kty');
  }

  /** @param {number|string} kty */
  set kty(kty) {
    this.setParam(KeyParameters.Kty, assertIntOrText(kty, 'kty'));
  }

  /** @returns {Uint8Array} */
  get kid() {
    return this.getBytes(KeyParameters.Kid, 'kid');
  }

  /** @param {Uint8Array} kid */
  set kid(kid) {
    this.setParam(KeyParameters.Kid, assertBytes(kid, 'kid'));
  }

  /** @returns {number|string} */
  get alg() {
    return this.getType(KeyParameters.Alg, assertIntOrText, 'alg');
  }

  /** @param {number|string} alg */
  set alg(alg) {
    this.setParam(KeyParameters.Alg, assertIntOrText(alg, 'alg'));
  }

  /** @returns {(number|string)[]} */
  get ops() {
    return this.getArray(KeyParameters.KeyOps, assertIntOrText, 'ops');
  }

  /** @param {(number|string)[]} ops */
  set ops(ops) {
    if (!Array.isArray(ops)) {
      throw new TypeError('ops must be an array');
    }
    ops.forEach((op) => assertIntOrText(op, 'ops'));
    this.setParam(KeyParameters.KeyOps, ops);
  }

  /** @returns {Uint8Array} */
  get baseIV() {
    return this.getBytes(KeyParameters.BaseIV, 'Base IV');
  }

  /** @param {Uint8Array} iv */
  set baseIV(iv) {
    this.setParam(KeyParameters.BaseIV, assertBytes(iv, 'Base IV'));
  }

  /**
   * Get the key material (secret) depending on key type.
   * @returns {Uint8Array}
   * @throws {Error} If the key type is not supported.
   */
  getSecret() {
    switch (this.kty) {
      case KeyTypes.EC2:
        return this.getBytes(EC2KeyParameters.D, 'd');
      default:
        throw new Error('unsupported key type');
    }
  }
}

module.exports = { CoseKey };
