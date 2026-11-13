/**
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
 */

const {
  chunk,
  find,
  flatten,
  flow,
  get,
  has,
  isArray,
  isEqual,
  isString,
  map,
  toLower,
} = require('lodash/fp');
const {
  findDepotsRequestSchema,
} = require('@verii/credentialing-hub-operator-api');
const { initClient } = require('./init-client');

// The most auth values tuples that one POST depots/get takes, from its
// request schema.
const MAX_AUTH_VALUES_PER_REQUEST = get(
  ['properties', 'authValues', 'maxItems'],
  findDepotsRequestSchema,
);

const ISSUER_SERVICES_PATH = 'operator/issuer-services/get';
const DEPOTS_PATH = 'operator/depots/get';
const CREATE_DEPOT_PATH = 'operator/depots/create';
const CREATE_CREDENTIALS_PATH = 'operator/credentials/create-many';
const RESOLVE_DEFERRED_PATH = 'operator/depots/resolve-deferred-credentials';
const REFRESH_ISSUE_LINKS_PATH = 'operator/issue-links/refresh';

// http-client's json() gives {} for a body that isn't JSON, such as a proxy's
// HTML page, so a response without what it should hold is an error rather
// than an empty result, which would pass the checks it was meant for.
const readResponse =
  (key, isExpected, description) => async (response, path) => {
    const value = get([key], await response.json());
    if (!isExpected(value)) {
      throw new Error(
        `${path} did not return ${description}. Check that --endpoint is the Credentialing Hub's base URL`,
      );
    }
    return value;
  };

const readServices = readResponse('services', isArray, 'a list of services');
const readDepots = readResponse('depots', isArray, 'a list of depots');
const readDepot = readResponse('depot', has('id'), 'a depot');
const readCredentials = readResponse(
  'credentials',
  isArray,
  'a list of credentials',
);
const readNotification = readResponse(
  'notification',
  has('status'),
  'a notification',
);
const readRedirectUrl = readResponse('redirectUrl', isString, 'a redirectUrl');

// Service ids are ObjectIds, which the Hub accepts in either case and
// returns in lower case.
const hasServiceId = (serviceId) =>
  flow(get('id'), toLower, isEqual(toLower(serviceId)));

/**
 * A client of the Credentialing Hub's operator API.
 * @param {{ endpoint: string, authToken: string }} options the Hub's base URL and an operator token
 */
const initHubClient = ({ endpoint, authToken }) => {
  const client = initClient({ prefixUrl: endpoint, bearerToken: authToken });

  const post = async (path, body, read) =>
    read(await client.post(path, body), path);

  /**
   * Gets an issuer service with issuer-services/get.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @returns {Promise<object|undefined>} the service, or undefined when the tenant has no such service
   * @throws when the response has no list of services
   */
  const getIssuerService = async ({ tenantId, serviceId }) => {
    const searchParams = new URLSearchParams({ tenantId, serviceId });
    const response = await client.get(ISSUER_SERVICES_PATH, { searchParams });
    const services = await readServices(response, ISSUER_SERVICES_PATH);
    return find(hasServiceId(serviceId), services);
  };

  const findDepotsChunk = ({ tenantId, serviceId }, authValues) =>
    post(DEPOTS_PATH, { tenantId, serviceId, authValues }, readDepots);

  /**
   * Finds the service's depots whose auth values match any of the tuples,
   * with POST depots/get, in requests of at most the tuples it takes.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @param {Array<Array<string|number|boolean>>} authValues the distinct tuples
   * @returns {Promise<Array<object>>} the depots
   * @throws when a response has no list of depots
   */
  const findDepotsByAuthValues = async (ids, authValues) => {
    const chunks = chunk(MAX_AUTH_VALUES_PER_REQUEST, authValues);
    const pages = await Promise.all(
      map((tuples) => findDepotsChunk(ids, tuples), chunks),
    );
    return flatten(pages);
  };

  /**
   * Creates a depot with depots/create.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @param {object} depot the new depot
   * @returns {Promise<object>} the depot
   * @throws an HTTP error with status 409 when another depot holds the auth values
   */
  const createDepot = ({ tenantId, serviceId }, depot) =>
    post(CREATE_DEPOT_PATH, { tenantId, serviceId, depot }, readDepot);

  /**
   * Creates credentials with credentials/create-many, which creates all of
   * them or none.
   * @param {{ tenantId: string }} ids
   * @param {Array<{ depotId: string, credential: object }>} items at most CREDENTIALS_CREATE_MANY_MAX_ITEMS
   * @returns {Promise<Array<object>>} the credentials, in the items' order
   * @throws an HTTP error with status 400, whose body lists the invalid items, when any item is invalid
   */
  const createCredentials = ({ tenantId }, items) =>
    post(CREATE_CREDENTIALS_PATH, { tenantId, items }, readCredentials);

  /**
   * Resolves a depot's deferred credentials with
   * depots/resolve-deferred-credentials.
   * @param {{ tenantId: string }} ids
   * @param {string} depotId
   * @returns {Promise<{ status: string, error?: string }>} the notification of a waiting wallet, whose status
   *   is sent, failed, skipped_no_messaging_settings or skipped_no_waiting_exchange
   */
  const resolveDeferredCredentials = ({ tenantId }, depotId) =>
    post(RESOLVE_DEFERRED_PATH, { tenantId, depotId }, readNotification);

  /**
   * Gets an issue link with issue-links/refresh. A depot's link replaces its
   * pre-authorized code, which breaks the links sent before.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @param {string} [depotId] the depot, or none for the service's shared link
   * @returns {Promise<string>} the link's redirectUrl
   */
  const refreshIssueLink = ({ tenantId, serviceId }, depotId) =>
    post(
      REFRESH_ISSUE_LINKS_PATH,
      { tenantId, serviceId, depotId },
      readRedirectUrl,
    );

  return {
    getIssuerService,
    findDepotsByAuthValues,
    createDepot,
    createCredentials,
    resolveDeferredCredentials,
    refreshIssueLink,
  };
};

module.exports = { initHubClient };
