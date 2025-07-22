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

const newError = require('http-errors');
const ethUrlParser = require('eth-url-parser');
const { isEmpty, isNil, map, omitBy } = require('lodash/fp');
const { nanoid } = require('nanoid/non-secure');
const { initTransformToFinder } = require('@verii/rest-queries');
const { tableRegistry } = require('@spencejs/spence-mongo-repos');
const { KeyPurposes } = require('@verii/crypto');
const {
  getRevocationRegistry,
} = require('@verii/velocity-issuing');
const { sendPush } = require('../../../../../fetchers');
const { issuedCredentialProjection } = require('../../../../../entities');

const issuedCredentialsController = async (fastify) => {
  const specificParams = {
    type: 'object',
    properties: {
      credentialId: { type: 'string', minLength: 1 },
      ...fastify.currentAutoSchemaPreset.params.properties,
    },
  };

  fastify.post(
    '/:credentialId/revoke',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        body: {
          $ref: 'https://velocitycareerlabs.io/revoke-credentials.schema.json#',
        },
        response: {
          200: {
            type: 'object',
            properties: {
              notifiedOfRevocationAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      }),
    },
    async (req) => {
      const {
        params: { credentialId },
        repos: { offers: offersRepo },
        body,
      } = req;
      const offer = await offersRepo.findOne(
        {
          filter: {
            did: credentialId,
          },
        },
        { _id: 1, credentialStatus: 1, exchangeId: 1, did: 1, type: 1 }
      );
      if (!offer) {
        throw newError.NotFound(`Credential ${credentialId} not found`);
      }
      if (isEmpty(offer.credentialStatus)) {
        throw newError.BadRequest(
          `Credential status not found for ${credentialId}`
        );
      }
      if (offer.credentialStatus.revokedAt) {
        return {};
      }

      await setRevokedOnChain(offer.credentialStatus.id, req);
      await setRevokedTime(credentialId, req);
      const { pushToken, pushUrl, exchange } = await getPushDelegate(
        offer,
        req
      );
      if (!pushToken || !pushUrl) {
        return {};
      }

      await triggerPush(
        {
          pushToken,
          offer,
          ...body,
        },
        { ...req, exchange }
      );
      const [{ notifiedOfRevocationAt }] = await setNotifiedTime(
        credentialId,
        offer,
        req
      );
      return {
        notifiedOfRevocationAt,
      };
    }
  );

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        query: {
          type: 'object',
          properties: {
            credentialId: {
              type: 'string',
            },
            vendorOfferId: {
              type: 'string',
            },
            vendorUserId: {
              type: 'string',
            },
            page: {
              type: 'object',
              properties: {
                size: { type: 'number' },
                skip: { type: 'number' },
              },
            },
            sort: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              issuedCredentials: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/issued-credential.schema.json#',
                },
              },
            },
          },
        },
      }),
    },
    async (req) => {
      const {
        query: { page, sort, credentialId, vendorOfferId, vendorUserId },
        repos,
      } = req;
      const filter = transformToFinder({
        filter: omitBy(isNil, {
          did: credentialId ?? { $exists: true },
          offerId: vendorOfferId,
          'credentialSubject.vendorUserId': vendorUserId ?? { $exists: true },
        }),
        page,
        sort,
      });

      const credentials = await repos.offers.find(
        filter,
        issuedCredentialProjection
      );

      return {
        issuedCredentials: map(buildIssuedCredential(req), credentials),
      };
    }
  );

  const setRevokedOnChain = async (credentialStatusUrl, context) => {
    const { tenant, tenantKeysByPurpose } = context;

    const {
      parameters: { address, listId, index },
    } = ethUrlParser.parse(credentialStatusUrl);

    const purpose =
      address.toLowerCase() === tenant.primaryAddress.toLowerCase()
        ? KeyPurposes.DLT_TRANSACTIONS
        : KeyPurposes.REVOCATIONS_FALLBACK;

    const revocationRegistry = await getRevocationRegistry(
      { dltOperatorKMSKeyId: tenantKeysByPurpose[purpose].keyId },
      context
    );
    return revocationRegistry.setRevokedStatusSigned({
      accountId: tenant.primaryAddress,
      listId,
      index,
      caoDid: context.caoDid,
    });
  };

  const transformToFinder = initTransformToFinder(await tableRegistry.offers());

  const getPushDelegate = async (offer, context) => {
    const { repos } = context;

    const exchange = await repos.exchanges.findOne({
      filter: {
        finalizedOfferIds: offer._id,
      },
    });

    return {
      pushToken: exchange?.pushDelegate?.pushToken,
      pushUrl: exchange?.pushDelegate?.pushUrl,
      exchange,
    };
  };
  const triggerPush = async (
    { offer, linkedOffer, message, pushToken },
    context
  ) => {
    const { tenant } = context;
    const notificationType = linkedOffer
      ? 'CredentialReplaced'
      : 'CredentialRevoked';
    return sendPush(
      {
        id: nanoid(),
        pushToken,
        message,
        data: {
          exchangeId: offer.exchangeId,
          notificationType,
          replacementCredentialType: linkedOffer?.credentialType,
          issuer: tenant.did,
          credentialId: offer.did,
          credentialTypes: offer.type,
          count: 1,
        },
      },
      context.exchange.pushDelegate,
      context
    );
  };

  const setRevokedTime = (credentialId, { repos }) =>
    repos.offers.updateUsingFilter(
      {
        filter: {
          did: credentialId,
        },
      },
      {
        'credentialStatus.revokedAt': new Date(),
      }
    );

  const setNotifiedTime = async (credentialId, offer, { repos }) =>
    repos.offers.updateUsingFilter(
      {
        filter: {
          did: credentialId,
        },
      },
      {
        notifiedOfRevocationAt: new Date(),
      }
    );
};

const buildIssuedCredential =
  ({ config }) =>
  (credential) => {
    const issuedCredential = omitBy(
      (v, k) => isNil(v) || k === 'issued',
      credential
    );
    // eslint-disable-next-line better-mutation/no-mutation
    issuedCredential.id = credential.did;

    if (issuedCredential.issuanceDate == null) {
      // eslint-disable-next-line better-mutation/no-mutation
      issuedCredential.issuanceDate = credential.issued;
    }

    if (config.vendorCredentialsIncludeIssuedClaim) {
      // eslint-disable-next-line better-mutation/no-mutation
      issuedCredential.issued =
        issuedCredential.issuanceDate ?? credential.issued;
    }
    return issuedCredential;
  };

module.exports = issuedCredentialsController;
