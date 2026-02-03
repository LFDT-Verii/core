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
const { nanoid } = require('nanoid');
const { initBuildRefreshToken } = require('@verii/crypto');
const { generateAccessToken } = require('../../../entities/tokens');

const buildRefreshToken = initBuildRefreshToken();
const controller = async (fastify) => {
  fastify.post(
    '/token',
    {
      schema: fastify.autoSchema({
        tags: ['careerwallet'],
        body: {
          type: 'object',
          properties: {
            audience: { type: 'string' },
            client_id: { type: 'string' },
          },
          required: ['audience', 'client_id'],
          oneOf: [
            {
              type: 'object',
              properties: {
                grant_type: {
                  type: 'string',
                  enum: ['authorization_code'],
                },
                authorization_code: { type: 'string' },
              },
              required: ['grant_type', 'authorization_code'],
            },
            {
              type: 'object',
              properties: {
                grant_type: {
                  type: 'string',
                  enum: ['refresh_token'],
                },
                refresh_token: { type: 'string' },
              },
              required: ['grant_type', 'refresh_token'],
            },
          ],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              refresh_token: { type: 'string' },
              token_type: { type: 'string', enum: ['Bearer'] },
            },
            required: ['access_token', 'token_type'],
          },
          ...fastify.UnauthorizedResponse,
        },
      }),
    },
    async (req) => {
      const { body, repos } = req;
      const {
        grant_type: grantType,
        authorization_code: authorizationCode,
        refresh_token: reqRefreshToken,
        client_id: clientId,
      } = body;

      validateOauthRequest(body, req);

      const feed = await matchFeed(
        {
          grantType,
          authorizationCode,
          refreshToken: reqRefreshToken,
          clientId,
        },
        req,
      );
      const user =
        await repos.vendorUserIdMappings.findOrInsertVendorUser(feed);

      const refreshToken = buildRefreshToken();
      await repos.feeds.update(`${feed._id}`, { clientId, refreshToken });
      const accessToken = await generateAccessToken(
        nanoid(),
        `${user._id}`,
        null,
        null,
        req,
      );
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
      };
    },
  );
};

const matchFeed = async (
  { grantType, authorizationCode, refreshToken, clientId },
  ctx,
) => {
  const { repos } = ctx;
  const filter =
    grantType === 'authorization_code'
      ? { preauthCode: authorizationCode }
      : { refreshToken, clientId };
  const sort = { updatedAt: -1 };
  const feed = await repos.feeds.findOne({ filter, sort });
  if (feed == null) {
    throw newError.Unauthorized();
  }
  return feed;
};

const validateOauthRequest = (body, ctx) => {
  if (body.audience !== ctx.tenant.did) {
    throw newError.BadRequest('Bad audience');
  }
};

module.exports = controller;
