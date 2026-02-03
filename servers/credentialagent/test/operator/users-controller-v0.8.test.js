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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { map, omit } = require('lodash/fp');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { mongoify } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initTenantFactory, initUserFactory } = require('../../src/entities');

const mappingsVendorUserIdUrl = (tenant) =>
  `/operator-api/v0.8/tenants/${tenant._id}/users`;

describe('vendor user id mappings', () => {
  let fastify;
  let persistVendorUserIdMapping;
  let newVendorUserIdMapping;
  let persistTenant;
  let tenant;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistVendorUserIdMapping, newVendorUserIdMapping } =
      initUserFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    tenant = await persistTenant();
  });

  after(async () => {
    await fastify.close();
  });

  it('should create a vendor user id mapping with email', async () => {
    const email = 'bob.dale@example.com';
    const payload = await newVendorUserIdMapping({ id: email, tenant });

    const response = await fastify.injectJson({
      method: 'POST',
      url: mappingsVendorUserIdUrl(tenant),
      payload: omit(['tenantId'], payload),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: email,
      _id: email,
      vendorUserId: payload.vendorUserId,
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });

    const dbResult = await mongoDb()
      .collection('vendorUserIdMappings')
      .findOne({ _id: email });
    expect(dbResult).toEqual(
      mongoify({
        _id: email,
        ...omit(['id'], payload),
        tenantId: tenant._id,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('should get a vendor user id mapping by email', async () => {
    const email = 'bob.dale@example.com';
    const vendorUser = await persistVendorUserIdMapping({ _id: email, tenant });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${mappingsVendorUserIdUrl(tenant)}/${encodeURIComponent(email)}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({ ...omit('_id', vendorUser), id: email });
  });

  it('should return all users', async () => {
    const user1 = await persistVendorUserIdMapping({
      _id: 'bob.dale@example.com',
      tenant,
    });
    const user2 = await persistVendorUserIdMapping({
      _id: 'amy.seal@example.com',
      tenant,
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: mappingsVendorUserIdUrl(tenant),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual(
      map((user) => ({ ...omit('_id', user), id: user._id }), [user2, user1]),
    );
  });

  it('should delete a vendor user by email', async () => {
    const email = 'bob.dale@example.com';
    await persistVendorUserIdMapping({ _id: email, tenant });

    const response = await fastify.injectJson({
      method: 'DELETE',
      url: `${mappingsVendorUserIdUrl(tenant)}/${encodeURIComponent(email)}`,
    });

    expect(response.statusCode).toEqual(204);
    const dbResult = await mongoDb()
      .collection('vendorUserIdMappings')
      .find({ _id: email })
      .toArray();
    expect(dbResult).toEqual([]);
  });
});
