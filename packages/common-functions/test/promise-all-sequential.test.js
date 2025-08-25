/**
 * Copyright 2023 Velocity Team
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

const { runSequentially } = require('../src/promise-all-sequential');

describe('Util sequential promise.all', () => {
  it('Should run sequentially', async () => {
    let counter = 0;
    const asyncFunc = async () => {
      counter += 1;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(counter);
        }, 100);
      });
    };

    const result = await runSequentially([asyncFunc, asyncFunc]);
    expect(result).toEqual([1, 2]);

    const resultParrallel = await Promise.all([asyncFunc(), asyncFunc()]);
    expect(resultParrallel).toEqual([4, 4]);
  });
});
