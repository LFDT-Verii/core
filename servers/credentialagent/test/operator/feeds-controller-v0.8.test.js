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
const _ = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');

const { ObjectId } = require('mongodb');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  initDisclosureFactory,
  initTenantFactory,
  initFeedFactory,
  feedRepoPlugin,
} = require('../../src/entities');

const feedsUrlPrefix = '/operator-api/v0.8/tenants/';

const feedsUrl = ({ tenant, disclosure }) =>
  `${feedsUrlPrefix}${tenant._id}/disclosures/${disclosure._id}/feeds`;

describe('CRUD Feeds Test Suite', () => {
  let fastify;
  let newFeed;
  let persistFeed;
  let persistDisclosure;
  let persistTenant;
  let feedsCollection;
  let tenant;
  let disclosure;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ newFeed, persistFeed } = initFeedFactory(fastify));
    feedsCollection = mongoDb().collection('feeds');
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await feedsCollection.deleteMany({});
    tenant = await persistTenant();
    disclosure = await persistDisclosure({ tenant, feed: true });
  });

  after(async () => {
    await fastify.close();
  });

  describe('Get All Feeds', () => {
    it('should 404 if disclosure is not found', async () => {
      await persistFeed({ tenant });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure: { _id: 'foo' },
        })}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'disclosure foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 400 if disclosure.feed is not "true"', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: false });
      await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_feed_not_true',
          message: 'Disclosure feed must be true',
          statusCode: 400,
        }),
      );
    });
    it('should 200 and return feeds of disclosure', async () => {
      const feed1 = await persistFeed({ tenant, disclosure });
      const feed2 = await persistFeed({ tenant, disclosure });
      await persistFeed({
        tenant,
        disclosure: await persistDisclosure({ tenant, feed: true }),
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        feeds: expect.arrayContaining([
          {
            ..._.omit(['_id'], feed2),
            id: feed2._id,
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          {
            ..._.omit(['_id'], feed1),
            id: feed1._id,
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ]),
      });
    });
  });

  describe('Get Feed', () => {
    it('should 404 if disclosure is not found', async () => {
      const feed1 = await persistFeed({ tenant, disclosure });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure: { _id: 'foo' },
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'disclosure foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/foo`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'feed foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed exists, but is not related to the disclosure', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: true });
      const feed = await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/${feed._id}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: `feed ${feed._id} not found`,
          statusCode: 404,
        }),
      );
    });
    it('should 400 if disclosure.feed is not "true"', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: false });
      const feed1 = await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_feed_not_true',
          message: 'Disclosure feed must be true',
          statusCode: 400,
        }),
      );
    });
    it('should 200 and return feed', async () => {
      const disclosure2 = await persistDisclosure({
        tenant,
        feed: true,
        clientId: 'fooClientId',
      });
      const feed1 = await persistFeed({ tenant, disclosure: disclosure2 });
      await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        feed: {
          ..._.omit(['_id'], feed1),
          id: feed1._id,
        },
      });
    });
  });

  describe('Delete Feed', () => {
    it('should 404 if disclosure is not found', async () => {
      const feed1 = await persistFeed({ tenant, disclosure });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${feedsUrl({
          tenant,
          disclosure: { _id: 'foo' },
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'disclosure foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/foo`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'feed foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed exists, but is not related to the disclosure', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: true });
      const feed = await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/${feed._id}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: `feed ${feed._id} not found`,
          statusCode: 404,
        }),
      );
    });
    it('should 400 if disclosure.feed is not "true"', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: false });
      const feed1 = await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_feed_not_true',
          message: 'Disclosure feed must be true',
          statusCode: 400,
        }),
      );
    });
    it('should 204 delete the feed', async () => {
      const feed1 = await persistFeed({ tenant, disclosure });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/${feed1._id}`,
      });

      expect(response.statusCode).toEqual(204);
      expect(response.json).toEqual({});
      expect(await feedsCollection.find().toArray()).toEqual([]);
    });
  });

  describe('Update Feed', () => {
    it('should 404 if disclosure is not found', async () => {
      const feed1 = await persistFeed({ tenant });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${feedsUrl({
          tenant,
          disclosure: { _id: 'foo' },
        })}/${feed1._id}`,
        payload: {
          vendorUserId: 'barVendorUserId',
          preauthCode: 'barPreauthCode',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'disclosure foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed exists but is not related to the disclosure', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: true });
      const feed = await persistFeed({
        tenant,
        disclosure: disclosure2,
        feed: true,
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/${feed._id}`,
        payload: {
          vendorUserId: 'barVendorUserId',
          preauthCode: 'barPreauthCode',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: `feed ${feed._id} not found`,
          statusCode: 404,
        }),
      );
    });
    it('should 404 if feed does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/foo`,
        payload: {
          vendorUserId: 'barVendorUserId',
          preauthCode: 'barPreauthCode',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'feed foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 400 if disclosure.feed is not "true"', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: false });
      const feed1 = await persistFeed({ tenant, disclosure: disclosure2 });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}/${feed1._id}`,
        payload: {
          vendorUserId: 'barVendorUserId',
          preauthCode: 'barPreauthCode',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_feed_not_true',
          message: 'Disclosure feed must be true',
          statusCode: 400,
        }),
      );
    });
    it('should 200 and strip additional properties, update feed, and clear feed.clientId', async () => {
      const feed1 = await persistFeed({
        tenant,
        disclosure,
        clientId: 'fooClientId',
      });
      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}/${feed1._id}`,
        payload: {
          feed: {
            preauthCode: 'barPreauthCode',
            vendorUserId: 'barVendorUserId',
            foo: 'foo',
          },
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        feed: {
          ..._.omit(['_id', 'clientId'], feed1),
          id: feed1._id,
          preauthCode: 'barPreauthCode',
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
      });
      const dbFeed = await feedsCollection.findOne({
        _id: new ObjectId(feed1._id),
      });
      expect(dbFeed).toEqual({
        ...mongoify(
          _.omit(['clientId'], {
            ...feed1,
            tenantId: tenant._id,
            disclosureId: disclosure._id,
          }),
        ),
        preauthCode: 'barPreauthCode',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('Create Feeds', () => {
    it('should 404 if disclosure is not found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${feedsUrl({
          tenant,
          disclosure: { _id: 'foo' },
        })}`,
        payload: {
          feeds: [
            { vendorUserId: 'barVendorUserId', preauthCode: 'barPreauthCode' },
          ],
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'disclosure foo not found',
          statusCode: 404,
        }),
      );
    });
    it('should 400 if disclosure.feed is not "true"', async () => {
      const disclosure2 = await persistDisclosure({ tenant, feed: false });

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${feedsUrl({
          tenant,
          disclosure: disclosure2,
        })}`,
        payload: {
          feeds: [
            {
              vendorUserId: 'barVendorUserId',
              preauthCode: 'barPreauthCode',
            },
          ],
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_feed_not_true',
          message: 'Disclosure feed must be true',
          statusCode: 400,
        }),
      );
    });
    it('should 200 and strip additional properties and create feeds', async () => {
      const feed1 = await newFeed({
        tenant,
        disclosure,
        vendorUserId: 'feed1VendorUserId',
        preauthCode: 'feed1PreauthCode',
      });
      const feed2 = await newFeed({
        tenant,
        disclosure,
        vendorUserId: 'feed2VendorUserId',
        preauthCode: 'feed2PreauthCode',
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${feedsUrl({
          tenant,
          disclosure,
        })}`,
        payload: {
          feeds: [
            {
              ...feed1,
              foo: 'foo',
            },
            feed2,
          ],
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        feeds: [
          {
            ..._.omit(['disclosureId'], feed1),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            vendorUserId: 'feed1VendorUserId',
            preauthCode: 'feed1PreauthCode',
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          {
            ..._.omit(['disclosureId'], feed1),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            vendorUserId: 'feed2VendorUserId',
            preauthCode: 'feed2PreauthCode',
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ],
      });
      const dbFeeds = await feedsCollection.find().toArray();
      expect(dbFeeds).toEqual([
        {
          ...mongoify(
            _.omit(['id'], {
              ...response.json.feeds[0],
              tenantId: tenant._id,
              disclosureId: disclosure._id,
            }),
          ),
          _id: new ObjectId(response.json.feeds[0].id),
        },
        {
          ...mongoify(
            _.omit(['id'], {
              ...response.json.feeds[1],
              tenantId: tenant._id,
              disclosureId: disclosure._id,
            }),
          ),
          _id: new ObjectId(response.json.feeds[1].id),
        },
      ]);
    });
  });

  it('feeds repo should not error if disclosure is not on the context', async () => {
    const initRepo = feedRepoPlugin(fastify);
    const repo = initRepo({
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
      disclosure: null,
    });
    expect(await repo.find()).toEqual([]);
  });
});
