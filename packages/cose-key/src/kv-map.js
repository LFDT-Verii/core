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

const { encodeCBOR, decodeCBOR } = require('./cose-utils');

/**
 * A label used as a key in the map. Can be a number or a string.
 * @typedef {number|string} Label
 */

/**
 * A value allowed in the map. Can be a number, string, boolean, Uint8Array, array of values, or another RawMap.
 * @typedef {number|string|Uint8Array|boolean|Value[]|RawMap} Value
 */

/**
 * A raw key-value map used internally by KVMap.
 * @typedef {Map<Label, Value>} RawMap
 */

/**
 * Assertion function that validates and returns a value of type T.
 * @template T
 * @callback AssertFn
 * @param {unknown} value
 * @param {string} name
 * @returns {T}
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {string}
 * @throws {TypeError}
 */
const assertText = (value, name) => {
  if (typeof value === 'string') {
    return value;
  }

  throw new TypeError(`${name} must be a string, but got ${String(value)}`);
};

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 * @throws {TypeError}
 */
const assertInt = (value, name) => {
  if (Number.isSafeInteger(value)) {
    return value;
  }

  throw new TypeError(`${name} must be an integer, but got ${String(value)}`);
};

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number|string}
 * @throws {TypeError}
 */
const assertIntOrText = (value, name) => {
  if (typeof value === 'string') {
    return value;
  }

  if (Number.isSafeInteger(value)) {
    return value;
  }

  throw new TypeError(
    `${name} must be an integer or string, but got ${String(value)}`
  );
};

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {Uint8Array}
 * @throws {TypeError}
 */
const assertBytes = (value, name) => {
  if (value instanceof Uint8Array) {
    return value;
  }

  throw new TypeError(`${name} must be a Uint8Array, but got ${String(value)}`);
};

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {boolean}
 * @throws {TypeError}
 */
const assertBool = (value, name) => {
  if (typeof value === 'boolean') {
    return value;
  }

  throw new TypeError(`${name} must be a Boolean, but got ${String(value)}`);
};

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {RawMap}
 * @throws {TypeError}
 */
const assertMap = (value, name) => {
  if (value instanceof Map) {
    return value;
  }

  throw new TypeError(`${name} must be a Map, but got ${String(value)}`);
};

/**
 * A class representing a key-value map with typed assertions and CBOR serialization.
 */
class KVMap {
  /**
   * @param {RawMap} [kv=new Map()]
   */
  constructor(kv = new Map()) {
    if (!(kv instanceof Map)) {
      throw new TypeError('key/value must be a Map');
    }
    this._raw = kv;
  }

  /**
   * Decode a KVMap from CBOR bytes.
   * @param {Uint8Array} data
   * @returns {KVMap}
   */
  static async fromBytes(data) {
    return new KVMap(await decodeCBOR(data));
  }

  /**
   * @param {Label} key
   * @returns {boolean}
   */
  has(key) {
    return this._raw.has(key);
  }

  /**
   * @param {Label} key
   * @returns {boolean}
   */
  delete(key) {
    return this._raw.delete(key);
  }

  /**
   * @param {Label} key
   * @param {string} [name]
   * @returns {number}
   */
  getInt(key, name) {
    return assertInt(this._raw.get(key), name ?? String(key));
  }

  /**
   * @param {Label} key
   * @param {string} [name]
   * @returns {string}
   */
  getText(key, name) {
    return assertText(this._raw.get(key), name ?? String(key));
  }

  /**
   * @param {Label} key
   * @param {string} [name]
   * @returns {Uint8Array}
   */
  getBytes(key, name) {
    return assertBytes(this._raw.get(key), name ?? String(key));
  }

  /**
   * @param {Label} key
   * @param {string} [name]
   * @returns {boolean}
   */
  getBool(key, name) {
    return assertBool(this._raw.get(key), name ?? String(key));
  }

  /**
   * @template T
   * @param {Label} key
   * @param {AssertFn<T>} assertFn
   * @param {string} [name]
   * @returns {T}
   */
  getType(key, assertFn, name) {
    return assertFn(this._raw.get(key), name ?? String(key));
  }

  /**
   * @template T
   * @param {Label} key
   * @param {AssertFn<T>} assertFn
   * @param {string} [name]
   * @returns {T[]}
   * @throws {TypeError}
   */
  getArray(key, assertFn, name) {
    const na = name || String(key);
    const arr = this._raw.get(key);

    if (!Array.isArray(arr)) {
      throw new TypeError(`${na} must be an array, but got ${String(arr)}`);
    }

    for (const item of arr) {
      assertFn(item, na);
    }

    return arr;
  }

  /**
   * @template T
   * @param {Label} key
   * @returns {T | undefined}
   */
  getParam(key) {
    return this._raw.get(key);
  }

  /**
   * @param {Label} key
   * @param {Value} value
   * @returns {this}
   */
  setParam(key, value) {
    this._raw.set(key, value);
    return this;
  }

  /**
   * @returns {RawMap}
   */
  clone() {
    return new Map(this._raw);
  }

  /**
   * @returns {Promise<Uint8Array>}
   */
  async toBytes() {
    return encodeCBOR(this._raw);
  }
}

module.exports = {
  assertText,
  assertInt,
  assertIntOrText,
  assertBytes,
  assertBool,
  assertMap,
  KVMap,
};
