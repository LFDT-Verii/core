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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  tenantLoaderPlugin,
  loadTenant,
} = require('../../src/plugins/tenant-loader-plugin');
const { initTenantFactory } = require('../../src/entities');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');

describe('tenant loader plugin', () => {
  let fastify;
  let persistTenant;
  let tenant;
  let db;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    db = await mongoDb();

    ({ persistTenant } = initTenantFactory(fastify));
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    db.collection('tenants').deleteMany({});
    tenant = await persistTenant();
  });

  describe('tenant loading', () => {
    it('load using _id', async () => {
      const req = {
        params: {
          tenantId: tenant._id.toString(),
        },
      };
      await expect(loadTenant(db, req.params, req)).resolves.toEqual({
        _id: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        did: tenant.did,
        primaryAddress: tenant.primaryAddress,
        updatedAt: expect.any(Date),
      });
    });

    it('load using did', async () => {
      const req = {
        params: {
          tenantId: tenant.did,
        },
      };

      await expect(loadTenant(db, req.params, req)).resolves.toEqual({
        _id: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        did: tenant.did,
        primaryAddress: tenant.primaryAddress,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('plugin', () => {
    // jest setup
    let server;
    const decorateRequest = jest.fn().mockImplementation(() => server);
    const addHook = jest.fn().mockImplementation(() => server);
    server = { decorateRequest, addHook };

    it("should load tenant by tenantId matching the '_id'", async () => {
      await tenantLoaderPlugin(server);
      expect(server.decorateRequest.mock.calls.length).toEqual(2);
      expect(server.addHook.mock.calls.length).toEqual(1);
    });
  });
});
