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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const cheerio = require('cheerio');
const buildFastify = require('./helpers/create-test-fastify');

const appRedirectUrl = '/app-redirect';

describe('app redirect controller test', () => {
  let fastify;

  before(async () => {
    fastify = await buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('should 400 if deeplink is not provided', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?exchange_type=uri`,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "querystring must have required property 'deeplink'",
    );
  });

  it('should link vnf wallet selection stylesheet', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?deeplink=f:oo`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    expect(response.headers['content-security-policy']).toBeDefined();

    const execResult = /script-src 'nonce-([^']*)'/.exec(
      response.headers['content-security-policy'],
    );
    const nonceFromCspHeader = execResult[1];

    const stylesheetTag = $('html > head > link[type="text/css"]');
    expect(stylesheetTag.attr('href')).toEqual(
      'http://lib.localhost.test/vnf-wallet-selection/site.css',
    );
    expect(stylesheetTag.attr('nonce')).toEqual(nonceFromCspHeader);
  });

  it('should include vnf wallet selection script', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${appRedirectUrl}?deeplink=f:oo`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    expect(response.headers['content-security-policy']).toBeDefined();
    const execResult = /script-src 'nonce-([^']*)'/.exec(
      response.headers['content-security-policy'],
    );
    const nonceFromCspHeader = execResult[1];

    const scriptTag = $('html > body > script');
    expect(scriptTag.attr('src')).toEqual(
      'http://lib.localhost.test/vnf-wallet-selection/index.js',
    );
    expect(scriptTag.attr('nonce')).toEqual(nonceFromCspHeader);
  });

  it('should include vnf wallet selection mount point with only deeplink if openid4vc_uri param is not present', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      // eslint-disable-next-line max-len
      url: `${appRedirectUrl}?deeplink=velocity-network-devnet%3A%2F%2Fissue%3Frequest_uri%3Dhttp%253A%252F%252Flocalhost.test%252Fvn-api%252Fr%252Fdid%253Aweb%253Alocalhost%2525253A3000%252Fget-credential-manifest%253Fid%253D6835916cf5c236c853ee27ab%26issuerDid%3Ddid%253Aweb%253Alocalhost%25253A3000`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    const scriptTag = $('html > body > #vnf-wallet-selection');
    const vnUri =
      // eslint-disable-next-line max-len
      'velocity-network-devnet://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fvn-api%2Fr%2Fdid%3Aweb%3Alocalhost%25253A3000%2Fget-credential-manifest%3Fid%3D6835916cf5c236c853ee27ab&issuerDid=did%3Aweb%3Alocalhost%253A3000';
    expect(scriptTag.attr('data-deeplink')).toEqual(vnUri);
    expect(scriptTag.attr('data-openid4vc-uri')).toBeUndefined();
    expect(scriptTag.attr('data-automode')).toEqual('');
  });

  it('should include vnf wallet selection mount point with deeplink and openid4vc_uri when both uris are present', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      // eslint-disable-next-line max-len
      url: `${appRedirectUrl}?deeplink=velocity-network-devnet%3A%2F%2Fissue%3Frequest_uri%3Dhttp%253A%252F%252Flocalhost.test%252Fvn-api%252Fr%252Fdid%253Aweb%253Alocalhost%2525253A3000%252Fget-credential-manifest%253Fid%253D683590b382fcd37f51116f9f%26issuerDid%3Ddid%253Aweb%253Alocalhost%25253A3000%26vendorOriginContext%3Ddepot%253A683590b382fcd37f51116fa0%253AetsLeZw5JaqNEvJi&openid4vc_uri=openid-credential-offer%3A%2F%2F%3Fcredential_offer%3D%257B%2522credential_issuer%2522%253A%2522https%253A%252F%252Flocalhost.test%252Fr%252F683590b382fcd37f51116f9e%252Fopenid%2522%252C%2522credential_configuration_ids%2522%253A%255B%2522pidSdJwt%2522%255D%252C%2522grants%2522%253A%257B%2522urn%253Aietf%253Aparams%253Aoauth%253Agrant-type%253Apre-authorized_code%2522%253A%257B%2522pre-authorized_code%2522%253A%2522etsLeZw5JaqNEvJi%2522%257D%257D%257D`,
    });
    expect(response.statusCode).toEqual(200);
    const $ = cheerio.load(response.body);

    const scriptTag = $('html > body > #vnf-wallet-selection');
    const vnUri =
      // eslint-disable-next-line max-len
      'velocity-network-devnet://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fvn-api%2Fr%2Fdid%3Aweb%3Alocalhost%25253A3000%2Fget-credential-manifest%3Fid%3D683590b382fcd37f51116f9f&issuerDid=did%3Aweb%3Alocalhost%253A3000&vendorOriginContext=depot%3A683590b382fcd37f51116fa0%3AetsLeZw5JaqNEvJi';
    const openid4vcUri =
      // eslint-disable-next-line max-len
      'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Flocalhost.test%2Fr%2F683590b382fcd37f51116f9e%2Fopenid%22%2C%22credential_configuration_ids%22%3A%5B%22pidSdJwt%22%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22etsLeZw5JaqNEvJi%22%7D%7D%7D';

    expect(scriptTag.attr('data-deeplink')).toEqual(vnUri);
    expect(scriptTag.attr('data-openid4vc-uri')).toEqual(openid4vcUri);
    expect(scriptTag.attr('data-automode')).toEqual('');
  });
});
