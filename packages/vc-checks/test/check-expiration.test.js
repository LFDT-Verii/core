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

const {
  credentialExpired,
  credentialUnexpired,
  credentialNoExpiration,
} = require('@verii/sample-data');
const { checkExpiration } = require('../src/check-expiration');
const { CheckResults } = require('../src/check-results');

describe('expiration checks', () => {
  it('Should return FAIL when expired', async () => {
    const result = checkExpiration(credentialExpired);

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return PASS when unexpired', async () => {
    const result = checkExpiration(credentialUnexpired);

    expect(result).toEqual(CheckResults.PASS);
  });

  it('Should return NOT_APPLICABLE when no expiration date', async () => {
    const result = checkExpiration(credentialNoExpiration);

    expect(result).toEqual('NOT_APPLICABLE');
  });
});
