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

const nock = require('nock');
const {
  ServiceCategories,
} = require('@verii/organizations-registry');
const {
  validateCao,
  validateCaoPlugin,
} = require('../../src/plugins/validate-cao-plugin');
const buildFastify = require('../operator/helpers/credentialagent-operator-build-fastify');

describe('validate cao plugin test suite', () => {
  let fastify;
  let warnSpy;

  beforeEach(async () => {
    fastify = buildFastify();
    await fastify.ready();
    warnSpy = jest.spyOn(fastify.log, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await fastify.close();
    warnSpy.mockRestore();
  });

  it('should warn if cao service does not exist', async () => {
    nock('http://oracle.localhost.test')
      .get('/api/v0.6/organizations/didtest/verified-profile')
      .reply(200, {
        credentialSubject: {
          permittedVelocityServiceCategory: [ServiceCategories.Issuer],
        },
      });
    await expect(() =>
      validateCao.call({
        ...fastify,
        config: {
          ...fastify.config,
          caoDid: 'didtest',
        },
      })
    ).rejects.toThrowError(
      // eslint-disable-next-line max-len
      'The provided CAO is not permitted to operator on the network. Make sure the organization exists on the registrar and is approved for Credential Agent Operation'
    );
  });

  it('should warn if registrar failed', async () => {
    nock('http://oracle.localhost.test')
      .get('/api/v0.6/organizations/didtest/verified-profile')
      .reply(400, {});
    await expect(() =>
      validateCao.call({
        ...fastify,
        config: {
          ...fastify.config,
          caoDid: 'didtest',
        },
      })
    ).rejects.toThrowError(
      // eslint-disable-next-line max-len
      'The provided CAO is not permitted to operator on the network. Make sure the organization exists on the registrar and is approved for Credential Agent Operation'
    );
  });

  it('should warn if register does not response', async () => {
    await validateCao.call({
      ...fastify,
      config: {
        ...fastify.config,
        caoDid: 'didtest',
      },
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'The registrar was not available for the request. Please check your firewall settings.'
    );
  });

  it('should warn if CAO DID validation turned off', async () => {
    await validateCao.call({
      ...fastify,
      config: {
        ...fastify.config,
        validateCaoDid: false,
      },
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('CAO DID validation is turned off.');
  });

  it('should not warn for valid cao', async () => {
    nock('http://oracle.localhost.test')
      .get('/api/v0.6/organizations/didtest/verified-profile')
      .reply(200, {
        credentialSubject: {
          permittedVelocityServiceCategory: [
            ServiceCategories.CredentialAgentOperator,
          ],
        },
      });
    await validateCao.call({
      ...fastify,
      config: {
        ...fastify.config,
        caoDid: 'didtest',
      },
    });
    expect(warnSpy).toHaveBeenCalledTimes(0);
  });

  it('should not add validation if is test env', async () => {
    const mockAddHook = jest.fn();
    validateCaoPlugin(
      {
        config: {
          isTest: true,
        },
        addHook: mockAddHook,
      },
      {},
      () => {}
    );
    expect(mockAddHook).toHaveBeenCalledTimes(0);
  });

  it('should add validation hook', async () => {
    const mockAddHook = jest.fn();
    validateCaoPlugin(
      {
        config: {
          isTest: false,
        },
        addHook: mockAddHook,
      },
      {},
      () => {}
    );
    expect(mockAddHook).toHaveBeenCalledTimes(1);
  });
});
