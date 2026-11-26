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

const { censorUrl, SECURITY_QUERY_PARAMS } = require('@verii/logger');

const restrictedKeys = {
  deny: ['forwarded', '-ip', 'remote-', 'via', '-user'],
};

// Sentry filters a query parameter, in the request url and its query string,
// when its name contains a denied entry, ignoring case. The last part of a
// dotted name also matches its bracketed form.
const buildUrlQueryParams = () => ({
  deny: [
    ...restrictedKeys.deny,
    ...SECURITY_QUERY_PARAMS.map((name) => name.split('.').at(-1)),
  ],
});

// Sentry v11 collects request bodies, cookies and user info by default.
// Keep the v10 baseline so credentials and PII are not attached to error events.
// Built when Sentry starts, so loading this module never reads the logger's lists.
const buildDataCollection = () => ({
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: [...restrictedKeys.deny, 'referer'] },
    response: restrictedKeys,
  },
  httpBodies: [],
  urlQueryParams: buildUrlQueryParams(),
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
});

// The deny list matches parameter names only, so it misses a listed parameter
// inside another parameter's value. Censor the request url and query string
// the way the request log does. Sentry's request data sets a string query
// string; one passed in another form to captureEvent is left as it is.
const censorRequest = (event) => {
  const { request } = event;
  if (!request) {
    return event;
  }
  return {
    ...event,
    request: {
      ...request,
      ...(request.url && { url: censorUrl(request.url) }),
      ...(typeof request.query_string === 'string' && {
        query_string: censorQuery(request.query_string),
      }),
    },
  };
};

// Outgoing request breadcrumbs keep their query string, filtered by the same
// name-only deny list, in data["url.query"]. Censor it the same way.
const censorBreadcrumb = (breadcrumb) => {
  const query = breadcrumb.data?.['url.query'];
  if (typeof query !== 'string') {
    return breadcrumb;
  }
  return {
    ...breadcrumb,
    data: { ...breadcrumb.data, 'url.query': censorQuery(query) },
  };
};

// Sentry keeps query strings without the leading "?".
const censorQuery = (query) => censorUrl(`?${query}`).slice(1);

// Tag every event with the server that sent it,
// so servers that share a Sentry project can be told apart.
const buildInitialScope = (serviceName) =>
  serviceName ? { initialScope: { tags: { service: serviceName } } } : {};

const initSentry = async ({
  dsn,
  release,
  environment,
  debug,
  serviceName,
}) => {
  const Sentry = await import('@sentry/node');

  Sentry.init({
    dsn,
    release,
    environment,
    debug,
    dataCollection: buildDataCollection(),
    beforeSend: censorRequest,
    beforeBreadcrumb: censorBreadcrumb,
    ...buildInitialScope(serviceName),
  });
  return Sentry;
};

// Only the tags in a sendError context reach Sentry. Callers also pass
// messages and request data in it for their own use.
const buildCaptureContext = (context) =>
  context?.tags ? [{ tags: context.tags }] : [];

const initSendError = async ({
  dsn,
  release,
  environment,
  debug = false,
  serviceName,
} = {}) => {
  if (dsn) {
    const sentry = await initSentry({
      dsn,
      release,
      environment,
      debug,
      serviceName,
    });
    return {
      sendError: (error, context) => {
        const code = error?.status || error?.statusCode;
        if (code >= 400 && code <= 404) {
          return;
        }
        sentry.captureException(error, ...buildCaptureContext(context));
      },
    };
  }
  return {
    sendError: () => {},
  };
};

module.exports = { initSendError };
