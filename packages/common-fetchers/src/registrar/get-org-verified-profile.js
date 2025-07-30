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

/**
 * Fetches the verified organization profile for a given organization DID.
 *
 * @param {string} orgDid - The Decentralized Identifier (DID) of the organization.
 * @param {Object} options - Options object.
 * @param {Object} options.registrarFetch - An object implementing a `get` method to perform the fetch.
 * @param {string} options.registrarFetch.responseType - Expected response type (e.g. 'promise').
 * @param {any} options.cache - Optional cache configuration.
 * @returns {Promise<Object>} A promise that resolves to the verified organization profile.
 */
const getOrganizationVerifiedProfile = async (
  orgDid,
  { registrarFetch, cache }
) => {
  const path = `api/v0.6/organizations/${encodeURIComponent(
    orgDid
  )}/verified-profile`;
  const options = { cache };
  if (registrarFetch.responseType === 'promise') {
    const response = await registrarFetch.get(path, options);
    return response.json();
  }
  return registrarFetch.get(path, options).json();
};

module.exports = {
  getOrganizationVerifiedProfile,
};
