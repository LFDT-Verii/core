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
  getCredentialTypeDescriptor,
} = require('../src/registrar/get-credential-type-descriptor');

const type = 'EmploymentPastV1.1';
const descriptor = { id: type, name: 'Employment', schema: [{ uri: 'uri' }] };
const stubDescriptor = { id: type, name: type, schema: [{ uri: type }] };

// @verii/http-client rejects with the status on the error
const promiseClient = (result) => ({
  get: async () => {
    if (result instanceof Error) {
      throw result;
    }
    return { json: async () => result };
  },
  responseType: 'promise',
});

// A got-style client rejects with the status on error.response
const callableClient = (result) => async () => {
  if (result instanceof Error) {
    throw result;
  }
  return { json: async () => result };
};

const errorWithStatus = (statusCode) =>
  Object.assign(new Error('Response Error'), { statusCode });

const errorWithResponseStatus = (statusCode) =>
  Object.assign(new Error('Response Error'), { response: { statusCode } });

const fetchDescriptor = (registrarFetch) =>
  getCredentialTypeDescriptor(
    { type, locale: 'en', includeDisplay: true },
    { registrarFetch },
  );

describe('getCredentialTypeDescriptor', () => {
  it('returns the descriptor', async () => {
    expect(await fetchDescriptor(promiseClient(descriptor))).toEqual(
      descriptor,
    );
    expect(await fetchDescriptor(callableClient(descriptor))).toEqual(
      descriptor,
    );
  });

  it('returns a basic descriptor when the type is not found', async () => {
    expect(await fetchDescriptor(promiseClient(errorWithStatus(404)))).toEqual(
      stubDescriptor,
    );
    expect(
      await fetchDescriptor(callableClient(errorWithResponseStatus(404))),
    ).toEqual(stubDescriptor);
  });

  it('rethrows other error statuses', async () => {
    const statusError = errorWithStatus(500);
    await expect(fetchDescriptor(promiseClient(statusError))).rejects.toBe(
      statusError,
    );

    const responseStatusError = errorWithResponseStatus(500);
    await expect(
      fetchDescriptor(callableClient(responseStatusError)),
    ).rejects.toBe(responseStatusError);
  });

  it('rethrows errors without a status', async () => {
    const connectionError = new Error('connect ECONNREFUSED');
    await expect(fetchDescriptor(promiseClient(connectionError))).rejects.toBe(
      connectionError,
    );
  });
});
