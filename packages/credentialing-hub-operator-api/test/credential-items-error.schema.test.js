/*
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
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const Ajv = require('ajv');
const { first, flow, map, omit } = require('lodash/fp');
const { CredentialErrors, credentialItemsErrorSchema } = require('..');

describe('credential items error schema', () => {
  const validate = new Ajv().compile(credentialItemsErrorSchema);

  const createManyError = {
    error: 'Bad Request',
    errorCode: CredentialErrors.REFERENCED_DEPOT_NOT_FOUND,
    message: CredentialErrors.REFERENCED_DEPOT_NOT_FOUND,
    statusCode: 400,
    requestId: 'request-1',
    errors: [
      {
        index: 1,
        path: '/items/1/depotId',
        errorCode: CredentialErrors.REFERENCED_DEPOT_NOT_FOUND,
        message: CredentialErrors.REFERENCED_DEPOT_NOT_FOUND,
      },
      {
        index: 3,
        path: '/items/3/credential/content/credentialSubject/name',
        errorCode: CredentialErrors.REQUEST_VALIDATION_FAILED,
        message: 'credential.content.credentialSubject/name must be string',
      },
    ],
  };

  it('should accept a credentials/create-many error that lists every invalid item', () => {
    expect(validate(createManyError)).toBe(true);
  });

  it('should accept an error without errors, such as a request body that fails validation', () => {
    expect(validate(omit(['errors'], createManyError))).toBe(true);
  });

  it('should require index, path, errorCode and message in each entry', () => {
    const firstEntry = first(createManyError.errors);
    const errorWithEntryMissing = (field) => ({
      ...createManyError,
      errors: [omit([field], firstEntry)],
    });

    expect(
      map(flow(errorWithEntryMissing, validate), [
        'index',
        'path',
        'errorCode',
        'message',
      ]),
    ).toEqual([false, false, false, false]);
  });
});
