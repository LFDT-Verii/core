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

const { get } = require('lodash/fp');

// An HTTP error carries the response's status code and body. Its request
// headers, which hold the operator token, are never printed.
const describeResponse = (error) => {
  const message = get(['body', 'message'], error) ?? error.message;
  return error.statusCode == null ? message : `${error.statusCode} ${message}`;
};

/**
 * Describes an error that stopped a command, such as an unreadable file or a
 * failed request, without the request's headers.
 * @param {Error} error
 * @returns {string} the description
 */
const describeError = (error) =>
  error.url == null
    ? error.message
    : `${error.url} failed: ${describeResponse(error)}`;

module.exports = { describeError };
