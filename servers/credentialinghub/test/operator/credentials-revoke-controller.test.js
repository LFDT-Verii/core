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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockSetRevokedStatusSigned = mock.fn();
mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initRevocationRegistry: () => ({
      setRevokedStatusSigned: mockSetRevokedStatusSigned,
    }),
  },
});

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const ethUrlParser = require('eth-url-parser');
const nock = require('nock').default;
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { KeyPurposes } = require('@verii/crypto');
const { nanoid } = require('nanoid');
const createTestFastify = require('../helpers/create-test-fastify');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const {
  initExchangeFactory,
  ExchangeProtocols,
} = require('../../src/entities/exchanges');
const { constructTenant } = require('../helpers/construct-tenant');

const testUrl = '/operator/credentials';
const REVOCATION_CONTRACT_ADDRESS =
  '0x1111111111111111111111111111111111111111';

describe('Credential Revocation Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;
  let persistExchange;

  let tenant;
  let issuerService;
  let depot;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));
  });

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    tenant = await persistTenant();
    issuerService = await persistIssuerService({ tenant });
    depot = await persistDepot({ tenant, service: issuerService });
    mockSetRevokedStatusSigned.mock.resetCalls();
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  it('should 400 if tenantId is missing', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: { credentialId: new ObjectId().toString() },
    });
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: "body must have required property 'tenantId'",
      }),
    );
  });

  it('should 400 if credentialId is missing', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: { tenantId: tenant._id },
    });
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: "body must have required property 'credentialId'",
      }),
    );
  });

  it('should 404 if credential is not found', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: tenant._id,
        credentialId: new ObjectId().toString(),
      },
    });
    expect(response.statusCode).toEqual(404);
    expect(response.json).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: expect.stringMatching(/^credential .* not found$/),
    });
  });

  it('should 400 if credential has not been issued', async () => {
    const credential = await persistCredential({ tenant, depot });
    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: tenant._id,
        credentialId: credential._id,
      },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        error: 'Bad Request',
        message: `Credential ${credential._id} is not issued`,
      }),
    );
  });

  it('should 400 if credential status is missing', async () => {
    const { tenant: revokingTenant, depot: revokingDepot } =
      await setupRevocationTenant();
    const credential = await persistIssuedCredential(
      revokingTenant,
      revokingDepot,
      { credentialStatus: undefined },
    );
    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        error: 'Bad Request',
        message: `Credential status not found for ${credential._id}`,
      }),
    );
  });

  it('should 400 if the tenant revocation key is missing', async () => {
    const { tenant: revokingTenant, credential } =
      await setupRevocationTenant();
    await mongoDb()
      .collection('tenants')
      .updateOne(
        { _id: new ObjectId(revokingTenant._id) },
        {
          $unset: {
            [`keysByPurpose.${KeyPurposes.DLT_TRANSACTIONS}`]: '',
          },
        },
      );

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Revocation key not found',
      }),
    );
    expect(mockSetRevokedStatusSigned.mock.calls).toHaveLength(0);

    const dbCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });
    expect(dbCredential).toEqual(mongoify(credential));
  });

  it('should revoke credential and skip notification when no messaging settings are saved', async () => {
    const { tenant: revokingTenant, credential } =
      await setupRevocationTenant();

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      credential: expect.objectContaining({
        id: credential._id,
        did: credential.did,
        revokedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      }),
      notification: { status: 'skipped_no_messaging_settings' },
      requestId: expect.any(String),
    });
    expect(mockSetRevokedStatusSigned.mock.calls[0].arguments).toEqual([
      {
        accountId: revokingTenant.primaryAccount,
        caoDid: revokingTenant.caoDid,
        index: '2',
        listId: '1',
      },
    ]);

    const dbCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });
    expect(dbCredential).toEqual({
      ...mongoify(credential),
      revokedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should revoke credential and send notification using latest VN API exchange messaging settings', async () => {
    const olderMessagingSettings = {
      webhookUrl: 'https://wallet.example.com/old-push',
      authToken: 'old-push-token',
    };
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'push-token-123',
    };
    const {
      tenant: revokingTenant,
      service,
      depot: revokingDepot,
      credential,
    } = await setupRevocationTenant();
    await persistVnApiExchange({
      tenant: revokingTenant,
      service,
      depot: revokingDepot,
      messagingSettings: olderMessagingSettings,
    });
    const exchange = await persistVnApiExchange({
      tenant: revokingTenant,
      service,
      depot: revokingDepot,
      messagingSettings,
    });
    const { nockedWebhook, getBody } = nockWebhook(messagingSettings);

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
        message: 'Credential revoked',
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      credential: expect.objectContaining({
        id: credential._id,
        did: credential.did,
        revokedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        notifiedOfRevocationAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      }),
      notification: { status: 'sent' },
      requestId: expect.any(String),
    });
    expect(nockedWebhook.isDone()).toEqual(true);
    expect(getBody()).toEqual({
      id: expect.any(String),
      pushToken: messagingSettings.authToken,
      message: 'Credential revoked',
      data: {
        exchangeId: `${exchange._id}`,
        notificationType: 'CredentialRevoked',
        replacementCredentialType: undefined,
        issuer: revokingTenant.did,
        credentialId: credential.did,
        credentialTypes: credential.content.type,
        count: 1,
      },
    });

    const dbCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });
    expect(dbCredential).toEqual({
      ...mongoify(credential),
      revokedAt: expect.any(Date),
      notifiedOfRevocationAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should send replacement notification when linked credential is supplied', async () => {
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'push-token-123',
    };
    const { tenant: revokingTenant, credential } = await setupRevocationTenant({
      messagingSettings,
    });
    const { nockedWebhook, getBody } = nockWebhook(messagingSettings);

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
        linkedCredential: {
          credentialId: new ObjectId().toString(),
          credentialType: 'ReplacementCredential',
        },
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(nockedWebhook.isDone()).toEqual(true);
    expect(getBody().data).toEqual(
      expect.objectContaining({
        notificationType: 'CredentialReplaced',
        replacementCredentialType: 'ReplacementCredential',
      }),
    );
  });

  it('should ignore embedded credential exchange messaging settings without a VN API exchange', async () => {
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'exchange-push-token',
    };
    const { tenant: revokingTenant, depot: revokingDepot } =
      await setupRevocationTenant();
    const credential = await persistIssuedCredential(
      revokingTenant,
      revokingDepot,
      {
        exchange: {
          _id: new ObjectId(),
          messagingSettings,
        },
      },
    );

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.notification).toEqual({
      status: 'skipped_no_messaging_settings',
    });
  });

  it('should not mark notification time if messaging fails', async () => {
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'push-token-123',
    };
    const { tenant: revokingTenant, credential } = await setupRevocationTenant({
      messagingSettings,
    });
    const webhookUrl = new URL(messagingSettings.webhookUrl);
    const nockedWebhook = nock(webhookUrl.origin)
      .post(webhookUrl.pathname)
      .replyWithError('wallet unavailable');

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.notification).toEqual({
      status: 'failed',
      error: expect.stringContaining('wallet unavailable'),
    });
    expect(response.json.credential.revokedAt).toEqual(
      expect.stringMatching(ISO_DATETIME_FORMAT),
    );
    expect(response.json.credential.notifiedOfRevocationAt).toBeUndefined();
    expect(nockedWebhook.isDone()).toEqual(true);

    const dbCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });
    expect(dbCredential.revokedAt).toEqual(expect.any(Date));
    expect(dbCredential.notifiedOfRevocationAt).toBeUndefined();
  });

  it('should notify without revoking on chain when credential was already revoked but not notified', async () => {
    const revokedAt = new Date();
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'push-token-123',
    };
    const { tenant: revokingTenant, depot: revokingDepot } =
      await setupRevocationTenant({ messagingSettings });
    const credential = await persistIssuedCredential(
      revokingTenant,
      revokingDepot,
      { revokedAt },
    );
    const { nockedWebhook } = nockWebhook(messagingSettings);

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      credential: expect.objectContaining({
        id: credential._id,
        did: credential.did,
        revokedAt: revokedAt.toISOString(),
        notifiedOfRevocationAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      }),
      notification: { status: 'sent' },
      requestId: expect.any(String),
    });
    expect(mockSetRevokedStatusSigned.mock.calls).toHaveLength(0);
    expect(nockedWebhook.isDone()).toEqual(true);

    const dbCredential = await mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });
    expect(dbCredential).toEqual({
      ...mongoify(credential),
      revokedAt,
      notifiedOfRevocationAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should not revoke or notify again if already notified', async () => {
    const revokedAt = new Date();
    const notifiedOfRevocationAt = new Date();
    const messagingSettings = {
      webhookUrl: 'https://wallet.example.com/push',
      authToken: 'push-token-123',
    };
    const { tenant: revokingTenant, depot: revokingDepot } =
      await setupRevocationTenant({ messagingSettings });
    const credential = await persistIssuedCredential(
      revokingTenant,
      revokingDepot,
      {
        revokedAt,
        notifiedOfRevocationAt,
      },
    );

    const response = await fastify.injectJson({
      method: 'POST',
      url: `${testUrl}/revoke`,
      payload: {
        tenantId: revokingTenant._id,
        credentialId: credential._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.notification).toEqual({ status: 'already_sent' });
    expect(mockSetRevokedStatusSigned.mock.calls).toHaveLength(0);
  });

  const setupRevocationTenant = async ({ messagingSettings } = {}) => {
    const { tenant: revokingTenant } = await constructTenant(
      persistTenant,
      persistKey,
    );
    const service = await persistIssuerService({ tenant: revokingTenant });
    const revokingDepot = await persistDepot({
      tenant: revokingTenant,
      service,
    });
    const credential = await persistIssuedCredential(
      revokingTenant,
      revokingDepot,
    );
    const exchange =
      messagingSettings == null
        ? undefined
        : await persistVnApiExchange({
            tenant: revokingTenant,
            service,
            depot: revokingDepot,
            messagingSettings,
          });
    return {
      tenant: revokingTenant,
      service,
      depot: revokingDepot,
      credential,
      exchange,
    };
  };

  const persistVnApiExchange = ({
    tenant: exchangeTenant,
    service,
    depot: depotRef,
    ...rest
  }) =>
    persistExchange({
      tenant: exchangeTenant,
      service,
      depotId: new ObjectId(depotRef._id),
      protocolMetadata: {
        protocol: ExchangeProtocols.VN_API,
      },
      ...rest,
    });

  const persistIssuedCredential = (revokingTenant, revokingDepot, overrides) =>
    persistCredential({
      tenant: revokingTenant,
      depot: revokingDepot,
      did: `did:test:${nanoid()}`,
      credentialSubjectId: `did:test:${nanoid()}`,
      acceptedAt: new Date(),
      credentialStatus: {
        id: buildRevocationUrl(revokingTenant),
        type: VelocityRevocationListType,
      },
      ...overrides,
    });
});

const buildRevocationUrl = (revokingTenant) =>
  ethUrlParser.build({
    scheme: 'ethereum',
    target_address: REVOCATION_CONTRACT_ADDRESS,
    function_name: 'getRevokedStatus',
    parameters: {
      address: revokingTenant.primaryAccount,
      listId: 1,
      index: 2,
    },
  });

const nockWebhook = ({ webhookUrl }) => {
  let body;
  const url = new URL(webhookUrl);
  const nockedWebhook = nock(url.origin)
    .matchHeader('authorization', /^Bearer .+/)
    .post(url.pathname, (requestBody) => {
      body = requestBody;
      return true;
    })
    .reply(204, null);

  return {
    nockedWebhook,
    getBody: () => body,
  };
};
