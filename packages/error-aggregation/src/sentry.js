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

const buildProfilingOptions = (enableProfiling) => {
  if (process.env.NODE_ENV != null && enableProfiling) {
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');
    return {
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      integrations: [nodeProfilingIntegration()],
    };
  }
  return {
    integrations: [],
  };
};
const initSentry = async ({
  dsn,
  enableProfiling,
  release,
  environment,
  debug,
}) => {
  const Sentry = await import('@sentry/node');

  Sentry.init({
    dsn,
    ...buildProfilingOptions(enableProfiling),
    release,
    environment,
    debug,
  });
  return Sentry;
};

const initStartProfiling = (sentry, enableProfiling) =>
  enableProfiling ? sentry.startTransaction : () => undefined;

const finishProfiling = (transaction) => {
  if (transaction) {
    transaction.finish();
  }
};

const initSendError = async ({
  dsn,
  enableProfiling,
  release,
  environment,
  debug = false,
} = {}) => {
  if (dsn) {
    const sentry = await initSentry({
      dsn,
      enableProfiling,
      release,
      environment,
      debug,
    });
    return {
      sendError: (error) => {
        const code = error?.status || error?.statusCode;
        if (code >= 400 && code <= 404) {
          return;
        }
        sentry.captureException(error);
      },
      startProfiling: initStartProfiling(sentry, enableProfiling),
      finishProfiling,
    };
  }
  return {
    sendError: () => {},
    startProfiling: () => {},
    finishProfiling: () => {},
  };
};

module.exports = { initSendError };
