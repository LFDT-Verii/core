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

const { nanoid } = require('nanoid');
const { map } = require('lodash/fp');
const { verifyCredentials } = require('@verii/verii-verification');
const httpError = require('http-errors');

const { KeyPurposes } = require('@verii/crypto');
const {
  resolveDid,
  getOrganizationVerifiedProfile,
  getCredentialTypeMetadata,
} = require('@verii/common-fetchers');
const { sendPush } = require('../../../../../fetchers');
const {
  checkPaymentRequirement,
  NotificationTypes,
} = require('../../../../../entities');

const inspectionController = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            rawCredentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  rawCredential: { type: 'string' },
                },
              },
            },
            pushData: {
              type: 'object',
              properties: {
                sendPush: {
                  type: 'boolean',
                },
                exchangeId: { type: 'string' },
                pushDelegate: {
                  type: 'object',
                  properties: {
                    pushUrl: { type: 'string' },
                    pushToken: { type: 'string' },
                  },
                  required: ['pushUrl', 'pushToken'],
                },
              },
              required: ['sendPush', 'exchangeId'],
            },
          },
          required: ['rawCredentials'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              credentials: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/vendor-credential.schema.json#',
                },
              },
            },
          },
          402: {
            $ref: 'error#',
          },
        },
      }),
    },
    async (req) => {
      const {
        body: { rawCredentials, pushData },
        tenantKeysByPurpose,
      } = req;

      const uncheckedCredentials = map('rawCredential', rawCredentials);
      const credentialsAndChecks = await verifyCredentials(
        {
          credentials: uncheckedCredentials,
          relyingParty: {
            dltOperatorKMSKeyId:
              tenantKeysByPurpose[KeyPurposes.DLT_TRANSACTIONS].keyId,
          },
        },
        {
          resolveDid,
          getOrganizationVerifiedProfile,
          getCredentialTypeMetadata,
        },
        req,
      );
      if (checkPaymentRequirement(credentialsAndChecks)) {
        throw httpError(400, 'No voucher was provided to process the request', {
          errorCode: 'payment_required',
        });
      }

      const pushDelegate = await getPushDelegate(pushData, req);

      if (pushDelegate) {
        const { exchangeId } = pushData;
        await sendPushVerification({ pushDelegate, exchangeId }, req);
      }

      return {
        credentials: map(
          ({ credential, credentialChecks }) => ({
            ...credential,
            credentialChecks,
          }),
          credentialsAndChecks,
        ),
      };
    },
  );

  const sendPushVerification = async (
    { exchangeId, pushDelegate },
    context,
  ) => {
    return sendPush(
      {
        id: nanoid(),
        pushToken: pushDelegate.pushToken,
        data: {
          notificationType: NotificationTypes.PRESENTATION_VERIFIFED,
          issuer: context.tenant.did,
          exchangeId,
          serviceEndpoint: pushDelegate.pushUrl,
        },
      },
      pushDelegate,
      context,
    );
  };

  // eslint-disable-next-line default-param-last, complexity
  const getPushDelegate = async (pushData = {}, { repos }) => {
    const { pushDelegate, exchangeId } = pushData;

    const exchange = await repos.exchanges.findOne({
      filter: {
        _id: exchangeId,
      },
    });
    const disclosure = await repos.disclosures.findOne({
      filter: {
        _id: exchange?.disclosureId,
      },
    });

    if (disclosureNotSendPush(disclosure)) {
      return null;
    }

    if (
      !disclosureNotSendPush(disclosure) &&
      verifyPushDelegate(exchange?.pushDelegate)
    ) {
      return exchange.pushDelegate;
    }

    if (pushData.sendPush && verifyPushDelegate(pushDelegate)) {
      return pushDelegate;
    }

    return null;
  };

  const disclosureNotSendPush = (disclosure) =>
    disclosure && disclosure.sendPushOnVerification === false;

  const verifyPushDelegate = (pushDelegate) => {
    const { pushUrl, pushToken } = pushDelegate || {};

    return !!pushUrl && !!pushToken;
  };
};

module.exports = inspectionController;
