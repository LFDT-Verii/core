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

const fp = require('fastify-plugin');

const { split } = require('lodash/fp');
const newError = require('http-errors');
const { verifyAccessToken } = require('../entities/tokens');

const initVerifyAccessToken = (options) => {
  const loadUser = async (internalUserId, context) => {
    try {
      return await context.repos.vendorUserIdMappings.findById(internalUserId);
    } catch (e) {
      context.log.warn(
        { accessToken: context.accessToken, err: e },
        'User in sub claim not found'
      );
      throw e;
    }
  };
  return async (req) => {
    if (options.feed === true) {
      const disclosureFeed = req.disclosure?.feed;
      if (disclosureFeed == null || disclosureFeed === false) {
        return req;
      }
    }
    const bearerToken = extractBearerToken(req);

    try {
      const { payload } = await verifyAccessToken(bearerToken, req);
      const user = await loadUser(payload.sub, req);
      /* eslint-disable better-mutation/no-mutation */
      req.accessToken = payload;
      req.user = user;
      req.log = req.log.child({
        // update the log to include access token and user if available
        traceId: req.traceId,
        accessToken: req.accessToken,
        user: req.user,
      });
      /* eslint-enable better-mutation/no-mutation */
      return req;
    } catch (error) {
      req.log.warn(error);
      throw newError(401, 'Unauthorized', {
        errorCode: 'unauthorized',
      });
    }
  };
};

const extractBearerToken = (req) => {
  const { headers } = req;
  const authParts = split(' ', headers.authorization);
  return authParts[1];
};

const verifyAccessTokenPlugin = async (fastify, options) => {
  if (!fastify.hasRequestDecorator('accessToken')) {
    fastify.decorateRequest('accessToken', null);
  }
  if (!fastify.hasRequestDecorator('user')) {
    fastify.decorateRequest('user', null);
  }
  fastify.addHook(
    options.hook ?? 'preValidation',
    initVerifyAccessToken(options)
  );
};

module.exports = {
  verifyAccessTokenPlugin: fp(verifyAccessTokenPlugin),
};
