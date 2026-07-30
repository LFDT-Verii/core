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
 */

const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const {
  createTestCaoSecurityProvider,
} = require('../helpers/create-test-cao-security-provider');
const createTestFastify = require('../helpers/create-test-fastify');

const OPERATOR_CAO_DID_INVALID = 'operator_cao_did_invalid';

describe('operator principal validation', () => {
  let fastify;

  afterEach(async () => {
    await fastify.close();
  });

  [
    {
      description: 'missing',
      principal: {
        subject: 'test-operator',
        subjectType: 'client',
        authenticationMethod: 'test',
      },
    },
    {
      description: 'empty',
      principal: {
        caoDid: '',
        subject: 'test-operator',
        subjectType: 'client',
        authenticationMethod: 'test',
      },
    },
    {
      description: 'whitespace-only',
      principal: {
        caoDid: '   ',
        subject: 'test-operator',
        subjectType: 'client',
        authenticationMethod: 'test',
      },
    },
    {
      description: 'non-string',
      principal: {
        caoDid: 123,
        subject: 'test-operator',
        subjectType: 'client',
        authenticationMethod: 'test',
      },
    },
  ].forEach(({ description, principal }) => {
    it(`rejects an operator principal whose caoDid is ${description}`, async () => {
      fastify = createTestFastify(
        { logSeverity: 'fatal' },
        {
          caoSecurityProvider: createTestCaoSecurityProvider(principal),
        },
      );

      const response = await fastify.injectJson({
        method: 'GET',
        url: '/operator/tenants/get',
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 401,
          error: 'Unauthorized',
          message: OPERATOR_CAO_DID_INVALID,
          errorCode: OPERATOR_CAO_DID_INVALID,
        }),
      );
    });
  });
});
