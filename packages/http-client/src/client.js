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

const { nanoid } = require('nanoid/non-secure');
const {
  Agent,
  interceptors,
  cacheStores,
  setGlobalDispatcher,
  getGlobalDispatcher,
} = require('undici');
const { createOidcInterceptor } = require('undici-oidc-interceptor');
const { map } = require('lodash/fp');
const pkg = require('../package.json');

const USER_AGENT_HEADER = `${pkg.name}/${pkg.version}`;
const registeredPrefixUrls = new Map();

const initCache = () => new cacheStores.MemoryCacheStore();

const initHttpClient = (options) => {
  const {
    prefixUrl,
    useExistingGlobalAgent,
    clientId,
    clientSecret,
    tokensEndpoint,
    scopes,
    audience,
    cache,
  } = options;

  const { clientOptions, traceIdHeader, customHeaders } = parseOptions(options);

  // register prefixUrl
  if (prefixUrl) {
    const parsedPrefixUrl = parsePrefixUrl(prefixUrl);
    registeredPrefixUrls.set(prefixUrl, parsedPrefixUrl);
  }

  if (!useExistingGlobalAgent) {
    const agent = new Agent(clientOptions).compose([
      interceptors.dns({ maxTTL: 300000, maxItems: 2000, dualStack: false }),
      interceptors.responseError(),
      ...addCache(cache),
      ...(tokensEndpoint
        ? [
            createOidcInterceptor({
              idpTokenUrl: tokensEndpoint,
              clientId,
              clientSecret,
              retryOnStatusCodes: [401],
              scopes,
              audience,
              urls: map((url) => url.origin, registeredPrefixUrls.values()),
            }),
          ]
        : []),
    ]);

    setGlobalDispatcher(agent);
  } else {
    const existingAgent = getGlobalDispatcher();
    const updatedAgent = existingAgent.compose([
      interceptors.responseError(),
      ...addCache(cache),
    ]);
    setGlobalDispatcher(updatedAgent);
  }

  const request = async (
    url,
    reqOptions,
    method,
    host,
    { traceId, log },
    body
  ) => {
    const reqId = nanoid();
    const reqHeaders = {
      'user-agent': USER_AGENT_HEADER,
      [traceIdHeader]: traceId,
      ...customHeaders,
      ...reqOptions?.headers,
    };
    const [origin, path] = buildUrl(host, url, reqOptions, clientOptions);

    log.info({ origin, path, url, reqId, reqHeaders }, 'HttpClient request');

    const globalAgent = getGlobalDispatcher();

    try {
      const httpResponse = await globalAgent.request({
        origin,
        path,
        method,
        headers: reqHeaders,
        ...(body ? { body } : {}),
      });
      const { statusCode, headers: resHeaders, body: rawBody } = httpResponse;
      return {
        rawBody,
        statusCode,
        resHeaders,
        json: async () => {
          const bodyJson = await rawBody.json();
          log.info(
            { origin, url, reqId, statusCode, resHeaders, body: bodyJson },
            'HttpClient response'
          );
          return bodyJson;
        },
        text: async () => {
          const bodyText = await rawBody.text();
          log.info(
            { origin, url, reqId, statusCode, resHeaders, body: bodyText },
            'HttpClient response'
          );
          return bodyText;
        },
      };
    } catch (error) {
      // eslint-disable-next-line better-mutation/no-mutation
      error.gatewayResponse = {
        url: `${origin}${path}`,
      };

      throw error;
    }
  };

  return (...args) => {
    let host;
    let context = args[0];
    if (args.length === 2) {
      host = registeredPrefixUrls.get(args[0]) ?? parsePrefixUrl(args[0]);
      context = args[1];
    }

    return {
      get: (url, reqOptions) =>
        request(url, reqOptions, HTTP_VERBS.GET, host, context),
      post: (url, payload, reqOptions) =>
        request(
          url,
          reqOptions,
          HTTP_VERBS.POST,
          host,
          context,
          JSON.stringify(payload)
        ),
      delete: (url, reqOptions) =>
        request(url, reqOptions, HTTP_VERBS.DELETE, host, context),
      responseType: 'promise',
    };
  };
};

const parseOptions = (options) => {
  const clientOptions = {
    connect: {
      rejectUnauthorized: options.tlsRejectUnauthorized,
    },
  };
  if (options.requestTimeout != null) {
    clientOptions.bodyTimeout = options.requestTimeout;
  }

  return {
    clientOptions,
    traceIdHeader: options.traceIdHeader ?? 'TRACE_ID',
    customHeaders: options.customHeaders ?? {},
  };
};

const parsePrefixUrl = (prefixUrl) => {
  const url = new URL(prefixUrl);
  return {
    origin: url.origin,
    rootPath:
      url.pathname.at(-1) === '/' ? url.pathname.slice(0, -1) : url.pathname,
  };
};

const buildUrl = (host, url, reqOptions, clientOptions) => {
  const fullUrl = reqOptions?.prefixUrl ? new URL(url, reqOptions.prefixUrl).toString() : url;

  return host && !reqOptions?.prefixUrl
    ? [host.origin, buildRelativePath(host.rootPath, url, reqOptions)]
    : parseFullURL(fullUrl, clientOptions, reqOptions);
};

const parseFullURL = (url, clientOptions, reqOptions) => {
  const { origin, pathname } = new URL(url);
  return [origin, addSearchParams(pathname, reqOptions?.searchParams)];
};

const buildRelativePath = (rootPath, url, reqOptions) =>
  addSearchParams(
    `${rootPath}${url.charAt[0] === '/' ? '' : '/'}${url}`,
    reqOptions?.searchParams
  );

const addSearchParams = (path, searchParams) =>
  searchParams != null ? `${path}?${searchParams}` : path;

const addCache = (store) =>
  store ? [interceptors.cache({ store, methods: ['GET'] })] : [];

const HTTP_VERBS = {
  GET: 'GET',
  POST: 'POST',
  DELETE: 'DELETE',
};

module.exports = { initHttpClient, parseOptions, parsePrefixUrl, initCache };
