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

const url = require('url');
const fp = require('fastify-plugin');
const newError = require('http-errors');
const { get, isEmpty, flow } = require('lodash/fp');
const { ERROR_CODES } = require('./constants');

const extractEndpoint = (endpointUrl) => {
  const lastTwoPathElements = url
    .parse(endpointUrl)
    .pathname.split('/')
    .slice(-2);
  return `/${lastTwoPathElements.join('/')}`;
};

const getDocsUrl = (endpointUrl, { endpointDocsMap } = {}) => {
  const endpoint = extractEndpoint(endpointUrl);
  return get(endpoint, endpointDocsMap);
};

const extractRequestPath = (requestUrl) => {
  return url.parse(requestUrl).pathname;
};

const ensureErrorCode = (err, fastify) => {
  if (typeof err !== 'object' || !isEmpty(err?.errorCode)) {
    return err;
  }
  fastify.log.error({
    message:
      'Error code missing. Please open a ticket with Velocity Network Foundation',
    err,
  });
  // eslint-disable-next-line better-mutation/no-mutation
  err.errorCode = ERROR_CODES.MISSING_ERROR_CODE;
  return err;
};

const addRequestId = (err, req) => {
  // eslint-disable-next-line better-mutation/no-mutation
  err.requestId = req?.id;
  return err;
};

const addValidationErrorCode = (err) => {
  if (err.validation == null) {
    return err;
  }
  // eslint-disable-next-line better-mutation/no-mutation
  err.errorCode = 'request_validation_failed';
  return err;
};

const transformToInternalServerError = (error, fastify) => {
  if (error.url && error.statusCode && error.statusCode < 500) {
    fastify.log.info('Transforming error to Internal Server Error', { error });

    return newError(500, 'Internal Server Error');
  }

  return error;
};

const errorsPlugin = (fastify, options, next) => {
  fastify.setErrorHandler((_error, request, reply) => {
    const error = flow(
      addValidationErrorCode,
      (err) => ensureErrorCode(err, fastify),
      (err) => addRequestId(err, request),
      (err) => transformToInternalServerError(err, fastify)
    )(_error);

    return reply.send(error);
  });
  next();
};

module.exports = {
  addValidationErrorCode,
  ensureErrorCode,
  addRequestId,
  extractRequestPath,
  getDocsUrl,
  errorsPlugin: fp(errorsPlugin, {
    fastify: '>=2.0.0',
    name: 'velocity-errors',
  }),
};
