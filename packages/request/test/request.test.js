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

const { GotError } = require('got');
const { NotFoundError } = require('http-errors');
const nock = require('nock');
const initRequest = require('../src/request');

describe('Request Execution', () => {
  const request = initRequest({})({
    log: console,
    traceId: 'TRACE-ID',
  });

  beforeAll(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    nock.cleanAll();
    nock('https://www.example.com').get('/').reply(200, 'Hello world!');
    nock('https://www.example.com')
      .get('/doodles')
      .reply(200, 'Hello Doodle World!');
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
    nock.enableNetConnect();
  });

  it('Should throw GotError', async () => {
    const result = () => request.get('https://UNKNOWN');
    await expect(result).rejects.toThrow(GotError);
  });

  it('Should throw NotFoundError', async () => {
    const result = () => request.get('https://www.example.com/404');
    await expect(result).rejects.toThrow(NotFoundError);
  });

  it('Should complete GET request with status 200', async () => {
    const response = await request.get('https://www.example.com');
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBeGreaterThan(10);
    expect(response.request.options.url.href).toEqual(
      'https://www.example.com/'
    );
  });

  it('Should complete FTP request with status 500', async () => {
    await expect(() => request.get('ftp://www.example.com')).rejects.toThrow();
  });

  it('Should use prefixes as expected', async () => {
    const prefixedRequest = initRequest({
      nodeEnv: 'test',
      prefixUrl: 'https://www.example.com',
      mapUrl: undefined,
    })({
      log: console,
    });

    const response = await prefixedRequest('doodles');
    await expect(response.statusCode).toEqual(200);
    expect(response.request.options.url.href).toEqual(
      'https://www.example.com/doodles'
    );
  });

  it('should map urls', async () => {
    const mappingRequest = initRequest({
      nodeEnv: 'test',
      prefixUrl: 'https://www.example.com',
      mapUrl: () => '/doodles',
    })({
      log: console,
    });
    const response = await mappingRequest('nonsense');
    await expect(response.statusCode).toEqual(200);
    expect(response.request.options.url.href).toEqual(
      'https://www.example.com/doodles'
    );
  });

  it('bearer token testing', async () => {
    nock('https://www.example.com').get('/').reply(200, 'Hello world!');

    const authRequestor = initRequest({ bearerToken: '123' })({
      log: console,
      traceId: 'TRACE-ID',
    });

    const response = await authRequestor('https://www.example.com');
    await expect(response.statusCode).toEqual(200);
    expect(response.request.options.url.href).toEqual(
      'https://www.example.com/'
    );
    expect(response.request.options.headers.Authorization).toEqual(
      'Bearer 123'
    );
    expect(response.request.options.headers.TRACE_ID).toEqual('TRACE-ID');
  });

  describe('traceId testing', () => {
    it('traceId from context gets sent as header', async () => {
      nock('https://www.example.com').get('/').reply(200, 'Hello world!');

      const authRequestor = initRequest({})({
        log: console,
        traceId: 'TRACE-ID',
      });

      const response = await authRequestor('https://www.example.com');
      await expect(response.statusCode).toEqual(200);
      expect(response.request.options.url.href).toEqual(
        'https://www.example.com/'
      );
      expect(response.request.options.headers.TRACE_ID).toEqual('TRACE-ID');
    });
  });

  describe('oauth test suite', () => {
    it('oauth testing testing with scope and no audience', async () => {
      nock('https://oauth.example.com')
        .post('/')
        .reply(200, { access_token: 'xyz', expires_in: 100000000 });

      const authRequestor = initRequest({
        clientId: '123',
        clientSecret: 'abc',
        scopes: 'profile',
        tokensEndpoint: 'https://oauth.example.com',
      })({
        log: console,
        traceId: 'TRACE-ID',
      });

      const response = await authRequestor('https://www.example.com');
      await expect(response.statusCode).toEqual(200);
      expect(response.request.options.url.href).toEqual(
        'https://www.example.com/'
      );
      expect(response.request.options.headers.Authorization).toEqual(
        'Bearer xyz'
      );
    });

    it('oauth testing testing with audience and no scope', async () => {
      nock('https://oauth.example.com')
        .post('/')
        .reply(200, { access_token: 'xyz', expires_in: 100000000 });

      const authRequestor = initRequest({
        clientId: '123',
        clientSecret: 'abc',
        audience: 'https://api.example.com',
        tokensEndpoint: 'https://oauth.example.com',
      })({
        log: console,
        traceId: 'TRACE-ID',
      });

      const response = await authRequestor('https://www.example.com');
      await expect(response.statusCode).toEqual(200);
      expect(response.request.options.url.href).toEqual(
        'https://www.example.com/'
      );
      expect(response.request.options.headers.Authorization).toEqual(
        'Bearer xyz'
      );
    });
  });

  it('should send custom errors if it can', async () => {
    nock('https://www.example.com')
      .post('/json')
      .reply(422, { message: 'invalid data' });

    const result = () =>
      request.post('https://www.example.com/json', {
        data: [1, 2],
        responseType: 'json',
      });

    await expect(result).rejects.toThrow(/invalid data/);
  });
});
