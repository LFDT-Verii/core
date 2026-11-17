/**
 * Copyright 2026 Velocity Team
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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { networkName } = require('../src/network-name');

describe('networkName', () => {
  it('should name each Velocity network the way people see it', () => {
    expect(networkName('devnet')).toEqual('DevNet');
    expect(networkName('testnet')).toEqual('TestNet');
    expect(networkName('mainnet')).toEqual('MainNet');
  });

  it('should keep any other network as it is', () => {
    expect(networkName('no-preset')).toEqual('no-preset');
    expect(networkName('ExampleNet')).toEqual('ExampleNet');
    expect(networkName('production')).toEqual('production');
    expect(networkName(undefined)).toBeUndefined();
  });

  it("should not give an object's own properties as names", () => {
    expect(networkName('constructor')).toEqual('constructor');
    expect(networkName('toString')).toEqual('toString');
  });
});
