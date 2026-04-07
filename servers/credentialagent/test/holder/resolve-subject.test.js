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

const {
  resolveSubject,
} = require('../../src/entities/offers/domains/resolve-subject');

describe('resolveSubject', () => {
  it('should throw error if proof is missing', async () => {
    await expect(resolveSubject(null, {})).rejects.toMatchObject({
      errorCode: 'invalid_or_missing_proof',
      message: 'proof is missing',
      statusCode: 400,
    });
  });

  it("should throw error if proof_type isn't jwt", async () => {
    await expect(
      resolveSubject(
        {
          proof_type: 'cwt',
          jwt: 'unused',
        },
        {},
      ),
    ).rejects.toMatchObject({
      errorCode: 'proof_type_invalid',
      message: "proof_type isn't set to jwt",
      statusCode: 400,
    });
  });
});
