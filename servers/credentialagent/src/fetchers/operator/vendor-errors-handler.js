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
const { includes } = require('lodash/fp');

const handleDnsError = (error) => {
  if (includes('getaddrinfo', error.message)) {
    throw newError(
      502,
      'DNS Error - Please verify that that the server has access to an internal DNS server, and that the vendor gateway api has an entry',
      {
        errorCode: 'upstream_network_dns_error',
      }
    );
  }
};

const handleConnectivityError = (error) => {
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
        errorCode: 'upstream_network_error',
      }
    );
  }
};

const handleBadRequestError = (error) => {
  if (error.response?.statusCode === 400) {
    throw newError(
      502,
      'Bad request sent from credential agent to vendor gateway (this should be raised with velocity support).',
      {
        errorCode: 'upstream_response_invalid',
      }
    );
  }
};

const handleUnauthorizedForbiddenError = (error) => {
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
        errorCode: 'upstream_unauthorized',
      }
    );
  }
};

const handleNotFoundError = (error, endpointPath) => {
  if (error.response?.statusCode === 404) {
    throw newError(
      502,
      `Missing implementation of the endpoint '${endpointPath}'.`,
      {
        errorCode: 'upstream_webhook_not_implemented',
      }
    );
  }
};

const handleUnexpectedError = () => {
  throw newError(
    502,
    'Unexpected error received connecting to vendor gateway.',
    {
      errorCode: 'upstream_unexpected_error',
    }
  );
};

const extractRequestPath = (requestUrl) => {
  return url.parse(requestUrl).pathname;
};

const handleVendorError = (error) => {
  const endpointPath = extractRequestPath(error.url);

  handleDnsError(error);
  handleConnectivityError(error);
  handleBadRequestError(error);
  handleUnauthorizedForbiddenError(error);
  handleNotFoundError(error, endpointPath);
  handleUnexpectedError();
};

module.exports = {
  handleVendorError,
};
