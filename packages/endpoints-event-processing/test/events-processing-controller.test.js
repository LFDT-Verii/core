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

const { wait } = require('@verii/common-functions');

const mockHandleCredentialIssuedRewardsEvent = jest.fn();
const mockHandleCouponsBurnedVerificationEvent = jest.fn();
const mockHandleCouponsMintedLoggingEvent = jest.fn();
const mockHandleCouponsBurnedLoggingEvent = jest.fn();
const mockHandleCredentialIssuedLoggingEvent = jest.fn();
jest.mock('../src/handlers', () => {
  return {
    handleCredentialIssuedRewardsEvent: mockHandleCredentialIssuedRewardsEvent,
    handleCouponsMintedLoggingEvent: mockHandleCouponsMintedLoggingEvent,
    handleCouponsBurnedVerificationEvent:
      mockHandleCouponsBurnedVerificationEvent,
    handleCouponsBurnedLoggingEvent: mockHandleCouponsBurnedLoggingEvent,
    handleCredentialIssuedLoggingEvent: mockHandleCredentialIssuedLoggingEvent,
  };
});

const buildFastify = require('./helpers/build-fastify');

describe('Event processing controller test suite', () => {
  let fastify;

  const baseUrl = 'api/v0.6/events-processing';

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await fastify.close();
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
      expect(mockHandleCredentialIssuedRewardsEvent).toHaveBeenCalledTimes(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCredentialIssuedRewardsEvent.mockRejectedValue(
        new Error('test error')
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-rewards`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedRewardsEvent).toHaveBeenCalledTimes(1);
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
      expect(mockHandleCouponsBurnedVerificationEvent).toHaveBeenCalledTimes(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsBurnedVerificationEvent.mockRejectedValue(
        new Error('test error')
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-verification`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedVerificationEvent).toHaveBeenCalledTimes(1);
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
      expect(mockHandleCouponsMintedLoggingEvent).toHaveBeenCalledTimes(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsMintedLoggingEvent.mockRejectedValue(
        new Error('test error')
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-minted-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsMintedLoggingEvent).toHaveBeenCalledTimes(1);
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
      expect(mockHandleCouponsBurnedLoggingEvent).toHaveBeenCalledTimes(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCouponsBurnedLoggingEvent.mockRejectedValue(
        new Error('test error')
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/coupons-burned-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCouponsBurnedLoggingEvent).toHaveBeenCalledTimes(1);
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
      expect(mockHandleCredentialIssuedLoggingEvent).toHaveBeenCalledTimes(1);
    });

    it('Should 200 and handle error from non-blocking process', async () => {
      mockHandleCredentialIssuedLoggingEvent.mockRejectedValue(
        new Error('test error')
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${baseUrl}/credential-issued-logging`,
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      await wait(0);
      expect(mockHandleCredentialIssuedLoggingEvent).toHaveBeenCalledTimes(1);
    });
  });
});
