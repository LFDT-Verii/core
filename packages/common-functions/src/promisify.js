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
 * @param {Function} fn - Function to promisify, must have error-first callback as the last argument
 * @returns {Function}
 * @example
 * const { promisify } = require('@verii/common-functions');
 * await promisify(fastify.verifyBearerAuth)(req, reply);
 */
const promisify =
  (fn) =>
  (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  };

module.exports = { promisify };
