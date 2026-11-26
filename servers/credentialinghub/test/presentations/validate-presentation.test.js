/**
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

const { throws } = require('node:assert/strict');
const { it } = require('node:test');
const { expect } = require('expect');
const {
  validatePresentation,
} = require('../../src/entities/presentations/domain/validate-presentation');

it('attaches only the descriptor to the error of an empty descriptor path', () => {
  const descriptor = {
    id: 'fixture-descriptor',
    path: '$.verifiableCredential[1]',
    format: 'jwt_vc',
  };
  const presentation = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    verifiableCredential: ['fixture-credential-jwt'],
    presentation_submission: {
      descriptor_map: [descriptor],
    },
  };
  const context = { compileValidationSchema: () => () => true };

  throws(
    () => validatePresentation(presentation, {}, context),
    (error) => {
      expect(error).toMatchObject({
        statusCode: 400,
        errorCode: 'presentation_jsonpath_empty',
        descriptor,
      });
      expect(error).not.toHaveProperty('json');
      return true;
    },
  );
});
