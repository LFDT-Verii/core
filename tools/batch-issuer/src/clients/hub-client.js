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
  isArray,
  isEqual,
  map,
  toLower,
  uniqBy,
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

// http-client's json() gives {} for a body that isn't JSON, such as a proxy's
// HTML page, so a response without the list is an error rather than an empty
// result, which would pass the checks it was meant for.
const readList = async (response, key, path) => {
  const body = await response.json();
  const list = get([key], body);
  if (!isArray(list)) {
    throw new Error(
      `${path} did not return a list of ${key}. Check that --endpoint is the Credentialing Hub's base URL`,
    );
  }
  return list;
};

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

  /**
   * Gets an issuer service with issuer-services/get.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @returns {Promise<object|undefined>} the service, or undefined when the tenant has no such service
   * @throws when the response has no list of services
   */
  const getIssuerService = async ({ tenantId, serviceId }) => {
    const searchParams = new URLSearchParams({ tenantId, serviceId });
    const response = await client.get(ISSUER_SERVICES_PATH, { searchParams });
    const services = await readList(response, 'services', ISSUER_SERVICES_PATH);
    return find(hasServiceId(serviceId), services);
  };

  const findDepotsChunk = async ({ tenantId, serviceId }, authValues) => {
    const body = { tenantId, serviceId, authValues };
    const response = await client.post(DEPOTS_PATH, body);
    return readList(response, 'depots', DEPOTS_PATH);
  };

  /**
   * Finds the service's depots whose auth values match any of the tuples,
   * with POST depots/get, at most 1000 tuples per request.
   * @param {{ tenantId: string, serviceId: string }} ids
   * @param {Array<Array<string|number|boolean>>} authValues the tuples
   * @returns {Promise<Array<object>>} the depots, each once
   * @throws when a response has no list of depots
   */
  const findDepotsByAuthValues = async (ids, authValues) => {
    const requests = flow(
      chunk(MAX_AUTH_VALUES_PER_REQUEST),
      map((tuples) => findDepotsChunk(ids, tuples)),
    )(authValues);
    const pages = await Promise.all(requests);
    return flow(flatten, uniqBy('id'))(pages);
  };

  return { getIssuerService, findDepotsByAuthValues };
};

module.exports = { initHubClient, MAX_AUTH_VALUES_PER_REQUEST };
