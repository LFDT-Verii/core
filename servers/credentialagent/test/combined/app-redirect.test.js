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
const cheerio = require('cheerio');
const buildFastify = require('./helpers/credentialagent-build-fastify');

const appRedirectUrl = '/app-redirect';

const setupNock = () => {
  nock('http://oracle.localhost.test')
    .get(
      '/api/v0.6/organizations/did%3Aion%3A4131209321321323123e/verified-profile'
    )
    .reply(200, {
      credentialSubject: { logo: '' },
    })
    .get('/api/v0.6/organizations/did%3Avnf%3Atest/verified-profile')
    .reply(200, {
      credentialSubject: { logo: '' },
    });
};

describe('app redirect controller test', () => {
  let fastify;

  beforeAll(async () => {
    fastify = await buildFastify();
    await fastify.ready();
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('should 400 if request_uri is not provided', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?exchange_type=uri`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "querystring must have required property 'request_uri'"
    );
  });

  it('should 400 if exchange_type is not provided', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "querystring must have required property 'exchange_type'"
    );
  });

  it('should 400 if exchange_type is not one of allowed values', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri&exchange_type=random`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      'querystring/exchange_type must be equal to one of the allowed values'
    );
  });

  it('should 400 if exchange_type is issue and inspectorDid provided', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri&exchange_type=issue&inspectorDid=abc`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      'inspectorDid should not be present for exchange_type = "issue"'
    );
  });

  it('should 400 if exchange_type is inspect and inspectorDid not provided', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri&exchange_type=inspect`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      'inspectorDid should be present for exchange_type = "inspect"'
    );
  });

  it('should 400 if exchange_type is not one of allowed values', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri&exchange_type=random`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      'querystring/exchange_type must be equal to one of the allowed values'
    );
  });

  it('should link vnf wallet selection stylesheet', async () => {
    const url =
      // eslint-disable-next-line max-len
      'http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId';
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=${url}&exchange_type=inspect&inspectorDid=321123`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    expect(response.headers['content-security-policy']).toBeDefined();

    const execResult = /script-src 'nonce-([^']*)'/.exec(
      response.headers['content-security-policy']
    );
    const nonceFromCspHeader = execResult[1];

    const stylesheetTag = $('html > head > link[type="text/css"]');
    expect(stylesheetTag.attr('href')).toEqual(
      'http://lib.localhost.test/vnf-wallet-selection/site.css'
    );
    expect(stylesheetTag.attr('nonce')).toEqual(nonceFromCspHeader);
  });

  it('should include vnf wallet selection script', async () => {
    const url =
      // eslint-disable-next-line max-len
      'http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId';
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=${url}&exchange_type=inspect&inspectorDid=321123`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    expect(response.headers['content-security-policy']).toBeDefined();
    const execResult = /script-src 'nonce-([^']*)'/.exec(
      response.headers['content-security-policy']
    );
    const nonceFromCspHeader = execResult[1];

    const scriptTag = $('html > body > script');
    expect(scriptTag.attr('src')).toEqual(
      'http://lib.localhost.test/vnf-wallet-selection/index.js'
    );
    expect(scriptTag.attr('nonce')).toEqual(nonceFromCspHeader);
  });

  it('should include vnf wallet selection mount point', async () => {
    const url =
      // eslint-disable-next-line max-len
      'http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId';
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=${url}&exchange_type=inspect&inspectorDid=321123`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    const scriptTag = $('html > body > #vnf-wallet-selection');
    const deeplink =
      // eslint-disable-next-line max-len
      'velocity-test://inspect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId&inspectorDid=321123';
    expect(scriptTag.attr('data-deeplink')).toEqual(deeplink);
    expect(scriptTag.attr('data-automode')).toEqual('');
  });
});
