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
 *
 */

const { describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const {
  logInvalidatedDepots,
} = require('../../src/entities/issuer-services/orchestrators/update-issuer-service');

const rules = [
  { path: ['$.credentialSubject.employeeId'], rule: 'pick', valueIndex: 0 },
  { path: ['$.credentialSubject.departmentId'], rule: 'equal', valueIndex: 1 },
];
const service = {
  authMethods: ['verifiable_presentation'],
  authMode: 'internal',
  verifiablePresentationAuthRules: rules,
  disclosureRequest: { types: [{ type: 'EmployeeIdV1.0' }] },
};
const swappedService = {
  ...service,
  verifiablePresentationAuthRules: [
    { ...rules[0], valueIndex: 1 },
    { ...rules[1], valueIndex: 0 },
  ],
};

const buildContext = (count) => ({
  repos: { depots: { count: mock.fn(count) } },
  log: { info: mock.fn(), warn: mock.fn() },
});

describe('logInvalidatedDepots', () => {
  const serviceId = new ObjectId().toString();

  it('should count and log the depots the new configuration invalidates', async () => {
    const context = buildContext(() => Promise.resolve(3));

    await logInvalidatedDepots(
      { serviceId, existingService: service, updatedService: swappedService },
      context,
    );

    expect(context.repos.depots.count.mock.calls[0].arguments).toEqual([
      {
        filter: {
          serviceId: new ObjectId(serviceId),
          authRulesFingerprint: { $ne: expect.any(String) },
        },
      },
    ]);
    expect(context.log.info.mock.calls[0].arguments).toEqual([
      { serviceId, invalidatedDepotCount: 3 },
      expect.stringContaining('auth configuration changed'),
    ]);
  });

  it('should count the depots with a fingerprint when VP auth is removed', async () => {
    const context = buildContext(() => Promise.resolve(1));

    await logInvalidatedDepots(
      {
        serviceId,
        existingService: service,
        updatedService: { ...service, authMethods: ['preauth'] },
      },
      context,
    );

    expect(
      context.repos.depots.count.mock.calls[0].arguments[0].filter,
    ).toEqual({
      serviceId: new ObjectId(serviceId),
      authRulesFingerprint: { $ne: null },
    });
    expect(context.log.info.mock.callCount()).toEqual(1);
  });

  it('should neither count nor log when the configuration is unchanged', async () => {
    const context = buildContext(() => Promise.resolve(3));

    await logInvalidatedDepots(
      {
        serviceId,
        existingService: service,
        updatedService: { ...service, description: 'updated' },
      },
      context,
    );

    expect(context.repos.depots.count.mock.callCount()).toEqual(0);
    expect(context.log.info.mock.callCount()).toEqual(0);
  });

  it('should log a warning and not throw when counting fails', async () => {
    const error = new Error('database unavailable');
    const context = buildContext(() => Promise.reject(error));

    await expect(
      logInvalidatedDepots(
        { serviceId, existingService: service, updatedService: swappedService },
        context,
      ),
    ).resolves.toBeUndefined();

    expect(context.log.info.mock.callCount()).toEqual(0);
    expect(context.log.warn.mock.calls[0].arguments).toEqual([
      { err: error, serviceId },
      expect.any(String),
    ]);
  });
});
