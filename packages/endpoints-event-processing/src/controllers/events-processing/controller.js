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

const { EventProcessingScopes } = require('../../entities');
const {
  handleCredentialIssuedRewardsEvent,
  handleCouponsBurnedVerificationEvent,
  handleCouponsMintedLoggingEvent,
  handleCouponsBurnedLoggingEvent,
  handleCredentialIssuedLoggingEvent,
} = require('../../handlers');

const controller = async (fastify) => {
  const { sendError } = fastify;

  const postOptions = {
    onRequest: [
      fastify.verifyAccessToken([EventProcessingScopes.EventsTrigger]),
    ],
    schema: fastify.autoSchema({
      tags: ['vnf_event_processing'],
      security: [
        {
          RegistrarOAuth2: [EventProcessingScopes.EventsTrigger],
        },
      ],
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
        },
      },
    }),
  };

  fastify.post('/credential-issued-rewards', postOptions, async (req) => {
    setTimeout(async () => {
      try {
        await handleCredentialIssuedRewardsEvent(req);
      } catch (e) {
        req.log.warn(e);
        sendError(e);
      }
    }, 0);
    return {};
  });

  fastify.post('/coupons-burned-verification', postOptions, async (req) => {
    setTimeout(async () => {
      try {
        await handleCouponsBurnedVerificationEvent(req);
      } catch (e) {
        req.log.warn(e);
        sendError(e);
      }
    }, 0);

    return {};
  });

  fastify.post('/coupons-minted-logging', postOptions, async (req) => {
    setTimeout(async () => {
      try {
        await handleCouponsMintedLoggingEvent(req);
      } catch (e) {
        req.log.warn(e);
        sendError(e);
      }
    }, 0);

    return {};
  });

  fastify.post('/coupons-burned-logging', postOptions, async (req) => {
    setTimeout(async () => {
      try {
        await handleCouponsBurnedLoggingEvent(req);
      } catch (e) {
        req.log.warn(e);
        sendError(e);
      }
    }, 0);

    return {};
  });

  fastify.post('/credential-issued-logging', postOptions, async (req) => {
    setTimeout(async () => {
      try {
        await handleCredentialIssuedLoggingEvent(req);
      } catch (e) {
        req.log.warn(e);
        sendError(e);
      }
    }, 0);

    return {};
  });
};

module.exports = controller;
