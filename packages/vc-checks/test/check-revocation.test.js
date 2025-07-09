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

const { checkCredentialStatus } = require('../src/check-credential-status');
const { CheckResults } = require('../src/check-results');
const { CredentialStatus } = require('../src/credential-status');

describe('revocation checks', () => {
  it('Should return NOT APPLICABLE when no credential status', async () => {
    const result = checkCredentialStatus(CredentialStatus.NOT_SUPPORTED);
    expect(result).toEqual(CheckResults.NOT_APPLICABLE);
  });

  it('Should return FAIL when revoked', async () => {
    const result = checkCredentialStatus(CredentialStatus.REVOKED);
    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return FAIL when revocation status fails to resolve', async () => {
    const result = checkCredentialStatus(
      CredentialStatus.DEPENDENCY_RESOLUTION_ERROR
    );
    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should return PASS when unrevoked', async () => {
    const result = checkCredentialStatus(CredentialStatus.UNREVOKED);

    expect(result).toEqual(CheckResults.PASS);
  });
});
