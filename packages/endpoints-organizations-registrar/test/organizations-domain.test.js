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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const {
  rootIssuerProfile,
  rootPrivateKey,
  rootIssuer,
} = require('@verii/sample-data');
const { JWT_FORMAT } = require('@verii/test-regexes');

const buildFastify = require('./helpers/build-fastify');
const { initBuildProfileVerifiableCredential } = require('../src/entities');

describe('Organizations Domain function tests', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  describe('buildProfileVerifiableCredential function tests', () => {
    it('buildProfileVerifiableCredential should create a jwt token containing the vc', async () => {
      const keyId = '#key-1';
      const buildProfileVerifiableCredential =
        initBuildProfileVerifiableCredential({
          config: {
            ...fastify.config,
            rootPrivateKey,
            rootKid: keyId,
          },
        });

      const { jwtVc } = await buildProfileVerifiableCredential(
        rootIssuerProfile,
        rootIssuer
      );
      expect(jwtVc).toEqual(expect.stringMatching(JWT_FORMAT));
    });
  });
});
