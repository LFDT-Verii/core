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

const { getClosest } = require('../src/entities');

describe('get closest string test suite', () => {
  it('should accept a string input and an array to pick the closest string from', () => {
    const data = getClosest('fast', ['slow', 'faster', 'fastest', 'hello']);
    expect(data).toBe('faster');
  });
  it('should not work when run with only one param', () => {
    try {
      getClosest('123');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(
        "Cannot read properties of undefined (reading 'length')"
      );
    }
  });
  it('still runs when arguments arent a string but doesnt find closest', () => {
    const data = getClosest(123, [789, 156]);
    expect(data).toBe(789);
  });
  it('should not find close numbers', () => {
    const data = getClosest('123', ['789', '456']);
    expect(data).not.toBe('456');
  });
  it('should not find close mix string numbers', () => {
    const data = getClosest('1abc2def3', ['789', '456', '7g8h9']);
    expect(data).not.toBe('456');
  });
});
