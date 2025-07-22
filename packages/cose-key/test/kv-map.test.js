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
const { KVMap, assertMap, assertInt } = require('../src/kv-map');

describe('KVMap', () => {
  it('should set and get integer value', () => {
    const map = new KVMap();
    map.setParam(1, 42);
    expect(map.getInt(1)).toEqual(42);
  });

  it('should correctly set, check existence, delete, and check absence of a value', () => {
    const map = new KVMap();
    const key = 100;
    map.setParam(key, 'test-value');
    expect(map.has(key)).toBe(true);
    map.delete(key);
    expect(map.has(key)).toBe(false);
  });

  it('should set and get string value', () => {
    const map = new KVMap();
    map.setParam(2, 'hello');
    expect(map.getText(2)).toEqual('hello');
  });

  it('should set and get boolean value', () => {
    const map = new KVMap();
    map.setParam(3, true);
    expect(map.getBool(3)).toEqual(true);
  });

  it('should set and get Uint8Array value', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const map = new KVMap();
    map.setParam(4, bytes);
    expect(map.getBytes(4)).toEqual(bytes);
  });

  it('should set and get array value with assertion', () => {
    const map = new KVMap();
    map.setParam(5, [1, 2, 3]);
    const arr = map.getArray(5, assertInt);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('should set and get nested map value', () => {
    const nestedMap = new Map([[10, 'nested']]);
    const map = new KVMap();
    map.setParam(6, nestedMap);
    expect(map.getType(6, assertMap)).toEqual(nestedMap);
  });

  it('should clone the map', () => {
    const map = new KVMap();
    map.setParam(1, 'clone');
    const cloned = map.clone();
    expect(cloned.get(1)).toEqual('clone');
  });

  it('should support getParam', () => {
    const map = new KVMap();
    map.setParam('key', 123);
    expect(map.getParam('key')).toEqual(123);
  });

  it('should support nil keys for getParam', () => {
    const map = new KVMap();
    map.setParam(null, 123);
    expect(map.getParam(null)).toEqual(123);
    map.setParam('', 456);
    expect(map.getParam('')).toEqual(456);
    map.setParam(undefined, 789);
    expect(map.getParam(undefined)).toEqual(789);
  });

  it('should support nil values for setParam', () => {
    const map = new KVMap();
    map.setParam('key1', null);
    expect(map.getParam('key1')).toEqual(null);
    map.setParam('key2', '');
    expect(map.getParam('key2')).toEqual('');
    map.setParam('key3', undefined);
    expect(map.getParam('key3')).toEqual(undefined);
  });

  it('should round-trip encode and decode with CBOR', async () => {
    const map = new KVMap();
    map.setParam(1, 'value');
    const encoded = await map.toBytes();
    const decoded = await KVMap.fromBytes(encoded);
    expect(decoded.getText(1)).toEqual('value');
  });
});
