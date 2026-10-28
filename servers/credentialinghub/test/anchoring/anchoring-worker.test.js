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
const { describe, it, after, before, beforeEach, mock } = require('node:test');
const { expect } = require('expect');

const mockAddCredentialMetadataEntry = mock.fn();
mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initRevocationRegistry: () => ({}),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mock.fn(),
    }),
    initVerificationCoupon: () => ({}),
  },
});
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const { applyOverrides, wait } = require('@verii/common-functions');
const { mongoify } = require('@verii/tests-helpers');
const { ObjectId } = require('mongodb');
const { nanoid } = require('nanoid');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const { ExchangeStates } = require('../../src/entities/exchanges');
const {
  NotificationEventStatuses,
  NotificationEventTypes,
} = require('../../src/entities/notifications');
const {
  buildNotificationEventDocument,
} = require('../../src/entities/notifications/repo/notification-events-repo-extension');
const {
  anchorNextCredential,
  buildAnchoringWorkerContext,
  enqueueAnchoring,
  startAnchoringWorker,
} = require('../../src/entities/anchoring');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const SECOND_MS = 1000;

describe('anchoring worker', () => {
  let fastify;
  let workerContext;
  let tenant;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    const { persistTenant } = initTenantFactory(fastify);
    const { persistKey } = initKeyFactory(fastify);
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('issuerKeys').deleteMany({});
    ({ tenant } = await constructTenant(persistTenant, persistKey));
    workerContext = buildAnchoringWorkerContext(fastify);
  });

  beforeEach(async () => {
    mockAddCredentialMetadataEntry.mock.resetCalls();
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('notification_events').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  // Enqueues the job as the notification handler does, a second ago so it's due
  const persistAcceptedCredential = async ({
    jobOverrides,
    jobTenant = tenant,
  } = {}) => {
    const issuerService = await persistIssuerService({ tenant });
    const depot = await persistDepot({ tenant, service: issuerService });
    const exchange = {
      id: nanoid(),
      serviceId: new ObjectId(issuerService._id),
      credentialMetadata: {
        isNewList: true,
        listId: 1,
        index: 2,
        contentHash: 'foo',
        algType: 'aes-256-gcm',
      },
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.CREDENTIALS_SIGNED, timestamp: new Date() },
      ],
    };
    const credential = await persistCredential({ tenant, depot, exchange });
    await enqueueAnchoring(
      {
        credential: { _id: new ObjectId(credential._id), exchange },
        tenant: { ...jobTenant, _id: new ObjectId(jobTenant._id) },
      },
      workerContext,
    );
    const jobId = `anchoring-${exchange.id}`;
    const acceptedAt = new Date(Date.now() - SECOND_MS);
    await mongoDb()
      .collection('notification_events')
      .updateOne(
        { _id: jobId },
        {
          $set: {
            nextAttemptAt: acceptedAt,
            createdAt: acceptedAt,
            ...jobOverrides,
          },
        },
      );
    const job = await findJob({ _id: jobId });
    return { credential, exchange, job };
  };

  const runWorker = () =>
    anchorNextCredential({ workerId: 'test-worker' }, workerContext);

  const findJob = (job) =>
    mongoDb().collection('notification_events').findOne({ _id: job._id });

  const findCredential = (credential) =>
    mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });

  const rejectNextAnchor = (error) =>
    mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
      Promise.reject(error),
    );

  const buildError = (message, errorCode) =>
    Object.assign(new Error(message), { errorCode });

  it('should do nothing when no job is due', async () => {
    await persistAcceptedCredential({
      jobOverrides: { nextAttemptAt: new Date(Date.now() + 60 * SECOND_MS) },
    });

    expect(await runWorker()).toEqual(false);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('should anchor an accepted credential and then record it as accepted', async () => {
    const { credential, exchange, job } = await persistAcceptedCredential();

    expect(await runWorker()).toEqual(true);

    expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments).toEqual([
      exchange.credentialMetadata,
      exchange.credentialMetadata.contentHash,
      tenant.caoDid,
      'aes-256-gcm',
    ]);
    expect(await findCredential(credential)).toEqual({
      ...mongoify(credential),
      exchange: expectedDbExchange(exchange, [ExchangeStates.COMPLETE], {
        acceptedAt: job.createdAt,
      }),
      acceptedAt: job.createdAt,
      updatedAt: expect.any(Date),
    });
    expect(await findJob(job)).toEqual({
      ...omitLockFields(job),
      status: NotificationEventStatuses.DELIVERED,
      attempts: 1,
      deliveredAt: expect.any(Date),
      retentionExpiresAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should retry a failed anchor later, and anchor on the retry', async () => {
    rejectNextAnchor(new Error('RPC unavailable'));
    const { credential, exchange, job } = await persistAcceptedCredential();

    const attemptedAt = Date.now();
    expect(await runWorker()).toEqual(true);

    const retryingJob = await findJob(job);
    expect(retryingJob).toEqual({
      ...omitLockFields(job),
      status: NotificationEventStatuses.RETRYING,
      attempts: 1,
      lastError: { message: 'RPC unavailable' },
      nextAttemptAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(retryingJob.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      attemptedAt + 10 * SECOND_MS,
    );
    expect(await findCredential(credential)).toEqual({
      ...mongoify(credential),
      exchange: expectedDbExchange(exchange),
      updatedAt: expect.any(Date),
    });
    expect(await runWorker()).toEqual(false);

    await mongoDb()
      .collection('notification_events')
      .updateOne({ _id: job._id }, { $set: { nextAttemptAt: new Date() } });
    expect(await runWorker()).toEqual(true);

    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
    expect(await findJob(job)).toEqual(
      expect.objectContaining({
        status: NotificationEventStatuses.DELIVERED,
        attempts: 2,
      }),
    );
    expect(await findCredential(credential)).toEqual(
      expect.objectContaining({ acceptedAt: job.createdAt }),
    );
  });

  it('should give up without retrying when the issuer lacks permission', async () => {
    rejectNextAnchor(
      buildError('not permitted', 'career_issuing_not_permitted'),
    );
    const { credential, exchange, job } = await persistAcceptedCredential();

    await runWorker();

    expect(await findJob(job)).toEqual({
      ...omitLockFields(job),
      status: NotificationEventStatuses.DEAD,
      attempts: 1,
      lastError: {
        message: 'not permitted',
        errorCode: 'career_issuing_not_permitted',
      },
      deadAt: expect.any(Date),
      retentionExpiresAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(await findCredential(credential)).toEqual({
      ...mongoify(credential),
      exchange: expectedDbExchange(
        exchange,
        [ExchangeStates.UNEXPECTED_ERROR],
        {
          err: 'not permitted',
          errorCode: 'career_issuing_not_permitted',
        },
      ),
      updatedAt: expect.any(Date),
    });
  });

  it('should give up without retrying when the index is already used', async () => {
    rejectNextAnchor(new Error('execution reverted: "Index already used"'));
    const { job } = await persistAcceptedCredential();

    await runWorker();

    expect(await findJob(job)).toEqual(
      expect.objectContaining({
        status: NotificationEventStatuses.DEAD,
        attempts: 1,
      }),
    );
  });

  it('should give up when the tenant no longer exists', async () => {
    const { job } = await persistAcceptedCredential({
      jobTenant: { ...tenant, _id: new ObjectId() },
    });

    await runWorker();

    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
    expect(await findJob(job)).toEqual(
      expect.objectContaining({
        status: NotificationEventStatuses.DEAD,
        lastError: {
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        },
      }),
    );
  });

  it('should give up after the last attempt fails', async () => {
    rejectNextAnchor(new Error('RPC unavailable'));
    const { credential, job } = await persistAcceptedCredential({
      jobOverrides: {
        status: NotificationEventStatuses.RETRYING,
        attempts: workerContext.config.anchoring.maxAttempts - 1,
      },
    });

    await runWorker();

    expect(await findJob(job)).toEqual(
      expect.objectContaining({
        status: NotificationEventStatuses.DEAD,
        attempts: workerContext.config.anchoring.maxAttempts,
      }),
    );
    expect((await findCredential(credential)).exchange.events).toEqual(
      expect.arrayContaining([
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: expect.any(Date) },
      ]),
    );
  });

  it('should leave a job another worker holds until its lock expires', async () => {
    const { job } = await persistAcceptedCredential({
      jobOverrides: {
        status: NotificationEventStatuses.DELIVERING,
        attempts: 1,
        lockedBy: 'other-worker',
        lockedUntil: new Date(Date.now() + 60 * SECOND_MS),
      },
    });

    expect(await runWorker()).toEqual(false);

    await mongoDb()
      .collection('notification_events')
      .updateOne(
        { _id: job._id },
        { $set: { lockedUntil: new Date(Date.now() - SECOND_MS) } },
      );
    expect(await runWorker()).toEqual(true);
    expect(await findJob(job)).toEqual(
      expect.objectContaining({
        status: NotificationEventStatuses.DELIVERED,
        attempts: 2,
      }),
    );
  });

  it('should not record the outcome on a credential issued again since', async () => {
    const { credential, exchange, job } = await persistAcceptedCredential();
    const reissuedExchange = { ...exchange, id: nanoid() };
    await mongoDb()
      .collection('credentials')
      .updateOne(
        { _id: new ObjectId(credential._id) },
        { $set: { exchange: reissuedExchange } },
      );

    await runWorker();

    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
    expect(await findJob(job)).toEqual(
      expect.objectContaining({ status: NotificationEventStatuses.DELIVERED }),
    );
    expect(await findCredential(credential)).toEqual({
      ...mongoify(credential),
      exchange: expectedDbExchange(reissuedExchange),
      updatedAt: expect.any(Date),
    });
  });

  it('should leave webhook events to the webhook worker', async () => {
    await mongoDb()
      .collection('notification_events')
      .insertOne(
        buildNotificationEventDocument({
          id: nanoid(),
          type: NotificationEventTypes.CREDENTIAL_ISSUED,
          version: 1,
        }),
      );

    expect(await runWorker()).toEqual(false);
  });

  it("should keep anchoring jobs out of the webhook worker's claim", async () => {
    await persistAcceptedCredential();

    expect(
      await workerContext.repos.notification_events.claimDueEvent({
        workerId: 'webhook-worker',
        lockDurationMs: SECOND_MS,
        types: Object.values(NotificationEventTypes),
      }),
    ).toEqual(null);
  });

  it('should anchor due jobs in the background until stopped', async () => {
    const { job } = await persistAcceptedCredential();
    const { config } = workerContext;
    const worker = startAnchoringWorker(
      { workerId: 'background-worker' },
      {
        ...workerContext,
        config: {
          ...config,
          anchoring: { ...config.anchoring, pollIntervalMs: 10 },
        },
      },
    );

    try {
      await waitForJobStatus(job, NotificationEventStatuses.DELIVERED);
    } finally {
      await worker.stop();
    }

    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
  });

  const waitForJobStatus = async (job, status, attemptsLeft = 100) => {
    if ((await findJob(job))?.status === status) {
      return;
    }
    if (attemptsLeft === 0) {
      throw new Error(`Job ${job._id} never reached ${status}`);
    }
    await wait(20);
    await waitForJobStatus(job, status, attemptsLeft - 1);
  };
});

// Claiming and finishing a job unsets its lock and last error
const omitLockFields = omit(['lockedBy', 'lockedUntil', 'lastError']);

const expectedDbExchange = (exchange, newEvents, overrides) =>
  applyOverrides(
    {
      ...mongoify(exchange),
      events: exchange.events.concat(
        (newEvents ?? []).map((state) => ({
          state,
          timestamp: expect.any(Date),
        })),
      ),
    },
    overrides,
  );
