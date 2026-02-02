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

const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockHandleCredentialIssuedRewardsEvent = mock.fn();
const mockHandleCouponsBurnedVerificationEvent = mock.fn();
const mockHandleCouponsMintedLoggingEvent = mock.fn();
const mockHandleCouponsBurnedLoggingEvent = mock.fn();
const mockHandleCredentialIssuedLoggingEvent = mock.fn();
mock.module('../src/handlers/index.js', {
  namedExports: {
    handleCredentialIssuedRewardsEvent: mockHandleCredentialIssuedRewardsEvent,
    handleCouponsMintedLoggingEvent: mockHandleCouponsMintedLoggingEvent,
    handleCouponsBurnedVerificationEvent:
      mockHandleCouponsBurnedVerificationEvent,
    handleCouponsBurnedLoggingEvent: mockHandleCouponsBurnedLoggingEvent,
    handleCredentialIssuedLoggingEvent: mockHandleCredentialIssuedLoggingEvent,
  },
});

const { wait } = require('@verii/common-functions');

const buildFastify = require('./helpers/build-fastify');

describe('Event processing controller test suite', () => {
  let fastify;

  const baseUrl = 'api/v0.6/events-processing';

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  beforeEach(() => {
    mockHandleCredentialIssuedRewardsEvent.mock.resetCalls();
    mockHandleCouponsMintedLoggingEvent.mock.resetCalls();
    mockHandleCouponsBurnedVerificationEvent.mock.resetCalls();
    mockHandleCouponsBurnedLoggingEvent.mock.resetCalls();
    mockHandleCredentialIssuedLoggingEvent.mock.resetCalls();
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('credentials issued rewards type test suite', () => {
    it('Should 200 and call non-blocking process before responding', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-rewards`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedRewardsEvent.mock.callCount()).toEqual(
        1,
      );
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCredentialIssuedRewardsEvent.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('test error')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-rewards`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedRewardsEvent.mock.callCount()).toEqual(
        1,
      );
    });
  });

  describe('coupons burned verification type test suite', () => {
    it('Should 200 and call non-blocking process before responding', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-verification`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedVerificationEvent.mock.callCount()).toEqual(
        1,
      );
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsBurnedVerificationEvent.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('test error')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-verification`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedVerificationEvent.mock.callCount()).toEqual(
        1,
      );
    });
  });

  describe('coupons minted logging type test suite', () => {
    it('Should 200 and call non-blocking process before responding', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-minted-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsMintedLoggingEvent.mock.callCount()).toEqual(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsMintedLoggingEvent.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('test error')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-minted-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsMintedLoggingEvent.mock.callCount()).toEqual(1);
    });
  });

  describe('coupons burned logging type test suite', () => {
    it('Should 200 and call non-blocking process before responding', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedLoggingEvent.mock.callCount()).toEqual(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsBurnedLoggingEvent.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('test error')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedLoggingEvent.mock.callCount()).toEqual(1);
    });
  });

  describe('Credential issued logging type test suite', () => {
    it('Should 200 and call non-blocking process before responding', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedLoggingEvent.mock.callCount()).toEqual(
        1,
      );
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCredentialIssuedLoggingEvent.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('test error')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedLoggingEvent.mock.callCount()).toEqual(
        1,
      );
    });
  });
});
