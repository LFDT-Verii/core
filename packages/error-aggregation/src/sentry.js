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

const initSentry = async ({ dsn, release, environment, debug }) => {
  const Sentry = await import('@sentry/node');

  Sentry.init({
    dsn,
    release,
    environment,
    debug,
  });
  return Sentry;
};
const initSendError = async ({
  dsn,
  release,
  environment,
  debug = false,
} = {}) => {
  if (dsn) {
    const sentry = await initSentry({ dsn, release, environment, debug });
    return {
      sendError: (error) => {
        const code = error?.status || error?.statusCode;
        if (code >= 400 && code <= 404) {
          return;
        }
        sentry.captureException(error);
      },
    };
  }
  return {
    sendError: () => {},
  };
};

module.exports = { initSendError };
