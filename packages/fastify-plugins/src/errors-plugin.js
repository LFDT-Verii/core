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
const newError = require('http-errors');
const fp = require('fastify-plugin');
const { includes, get, isEmpty, flow } = require('lodash/fp');
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

const handleDnsError = (error, docsUrl) => {
  if (includes('getaddrinfo', error.message)) {
    throw newError(
      502,
      'DNS Error - Please verify that that the server has access to an internal DNS server, and that the vendor gateway api has an entry',
      {
        endpointDocumentation: docsUrl,
        errorCode: 'upstream_network_dns_error',
      }
    );
  }
};

const handleConnectivityError = (error, docsUrl) => {
  if (
    includes('ETIMEDOUT', error.message) ||
    includes('EPIPE', error.message) ||
    includes('ECONNRESET', error.message) ||
    includes('ECONNREFUSED', error.message)
  ) {
    throw newError(
      502,
      'Connectivity Error - Unable to connect to the vendor gateway. Please check routing tables and firewall settings',
      {
        endpointDocumentation: docsUrl,
        errorCode: 'upstream_network_error',
      }
    );
  }
};

const handleBadRequestError = (error, docsUrl) => {
  if (error.response?.statusCode === 400) {
    throw newError(
      502,
      'Bad request sent from credential agent to vendor gateway (this should be raised with velocity support).',
      {
        endpointDocumentation: docsUrl,
        errorCode: 'upstream_response_invalid',
      }
    );
  }
};

const handleUnauthorizedForbiddenError = (error, docsUrl) => {
  if (
    error.response?.statusCode === 401 ||
    error.response?.statusCode === 403
  ) {
    throw newError(
      502,
      'Bad authentication of the server. Please review the supported authentication methods for the agent.',
      {
        authenticationDocumentation:
          'https://docs.velocitycareerlabs.io/#/./Authentication',
        endpointDocumentation: docsUrl,
        errorCode: 'upstream_unauthorized',
      }
    );
  }
};

const handleNotFoundError = (error, endpointPath, docsUrl) => {
  if (error.response?.statusCode === 404) {
    throw newError(
      502,
      `Missing implementation of the endpoint '${endpointPath}'.`,
      {
        endpointDocumentation: docsUrl,
        errorCode: 'upstream_webhook_not_implemented',
      }
    );
  }
};

const handleUnexpectedError = (docsUrl) => {
  throw newError(
    502,
    'Unexpected error received connecting to vendor gateway.',
    {
      endpointDocumentation: docsUrl,
      errorCode: 'upstream_unexpected_error',
    }
  );
};

const handleVendorError = (error, endpointPath, docsUrl) => {
  handleDnsError(error, docsUrl);
  handleConnectivityError(error, docsUrl);
  handleBadRequestError(error, docsUrl);
  handleUnauthorizedForbiddenError(error, docsUrl);
  handleNotFoundError(error, endpointPath, docsUrl);
  handleUnexpectedError(docsUrl);
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
const errorsPlugin = (fastify, options, next) => {
  fastify.setErrorHandler((_error, request, reply) => {
    const { sendError = () => {} } = fastify;
    const error = flow(
      addValidationErrorCode,
      (err) => ensureErrorCode(err, fastify),
      (err) => addRequestId(err, request)
    )(_error);

    if (error.gatewayResponse) {
      try {
        handleVendorError(
          error,
          extractRequestPath(error.gatewayResponse.url),
          getDocsUrl(error.gatewayResponse.url.toLowerCase(), options)
        );
      } catch (modifiedError) {
        sendError(error);
        return reply.send(modifiedError);
      }
    }
    sendError(error);
    return reply.send(error);
  });
  next();
};

module.exports = {
  addValidationErrorCode,
  handleVendorError,
  ensureErrorCode,
  addRequestId,
  extractRequestPath,
  getDocsUrl,
  errorsPlugin: fp(errorsPlugin, {
    fastify: '>=2.0.0',
    name: 'velocity-errors',
  }),
};
