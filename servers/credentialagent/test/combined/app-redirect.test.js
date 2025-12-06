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
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
} = require('node:test');
const { expect } = require('expect');

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

  before(async () => {
    fastify = await buildFastify();
    await fastify.ready();
  });

  beforeEach(async () => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  after(async () => {
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

  it('should 400 if exchange_type is claim.wizard and inspectorDid not provided', async () => {
    setupNock();
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?request_uri=uri&exchange_type=claim.wizard`,
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

  it('should include vnf wallet selection mount point', async () => {
    setupNock();
    const url =
      // eslint-disable-next-line max-len
      'http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId';
    const response = await fastify.injectJson({
      method: 'GET',
      // eslint-disable-next-line max-len
      url: `${appRedirectUrl}?request_uri=${url}&exchange_type=claim.wizard&inspectorDid=321123providers=%5B%7B%22logo%22%3A%22https%3A//upload.wikimedia.org/wikipedia/commons/a/aa/LinkedIn_2021.svg%22%2C%22name%22%3A%22LinkedIn%22%2C%22category%22%3A%22Personal%20Records%22%2C%22id%22%3A%22a9f1063c-06b7-476a-8410-9ff6e427e637%22%7D%2C%7B%22logo%22%3A%22https%3A//logos-world.net/wp-content/uploads/2020/11/GitHub-Emblem.png%22%2C%22name%22%3A%22GitHub%22%2C%22category%22%3A%22User%20Profile%22%2C%22id%22%3A%226d3f6753-7ee6-49ee-a545-62f1b1822ae5%22%7D%5D`,
    });

    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    const scriptTag = $('html > body > #vnf-wallet-selection');
    const deeplink =
      // eslint-disable-next-line max-len
      'velocity-test://claim.wizard?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3A4131209321321323123e%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D5f123eab4362bb2e%26credential_types%3DPastEmploymentPosition%26id%3DsecretId&inspectorDid=321123providers%3D%5B%7B%22logo%22%3A%22https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2Fa%2Faa%2FLinkedIn_2021.svg%22%2C%22name%22%3A%22LinkedIn%22%2C%22category%22%3A%22Personal+Records%22%2C%22id%22%3A%22a9f1063c-06b7-476a-8410-9ff6e427e637%22%7D%2C%7B%22logo%22%3A%22https%3A%2F%2Flogos-world.net%2Fwp-content%2Fuploads%2F2020%2F11%2FGitHub-Emblem.png%22%2C%22name%22%3A%22GitHub%22%2C%22category%22%3A%22User+Profile%22%2C%22id%22%3A%226d3f6753-7ee6-49ee-a545-62f1b1822ae5%22%7D%5D';
    expect(scriptTag.attr('data-reclaim')).toEqual(deeplink);
    expect(scriptTag.attr('data-automode')).toEqual('');
  });
});
