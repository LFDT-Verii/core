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
  getGlobalDispatcher
} = require('undici');
const { createOidcInterceptor } = require('undici-oidc-interceptor');
const { map } = require('lodash/fp');
const pkg = require('../package.json');

const USER_AGENT_HEADER = `${pkg.name}/${pkg.version}`;
const registeredPrefixUrls = new Map();

const initCache = () => new cacheStores.MemoryCacheStore();

const initHttpClient = (options) => {
  const {
    prefixUrls,
    skipAgentInit,
    clientId,
    clientSecret,
    tokensEndpoint,
    scopes,
    audience,
    cache,
  } = options;

  const {
    clientOptions,
    traceIdHeader,
    customHeaders,
  } = parseOptions(options);

  // register prefixUrls
  for (const prefixUrl of prefixUrls ?? []) {
    const parsedPrefixUrl = parsePrefixUrl(prefixUrl);
    registeredPrefixUrls.set(prefixUrl, parsedPrefixUrl);
  }

  if (!skipAgentInit) {
    const agent =
      new Agent(clientOptions).compose([
        interceptors.dns({ maxTTL: 300000, maxItems: 2000, dualStack: false }),
        interceptors.responseError(),
        interceptors.cache({ cache, methods: ['GET'] }),
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
    };
    const [origin, path] =
      host != null
        ? [host.origin, buildRelativePath(host.rootPath, url, reqOptions)]
        : parseFullURL(url, clientOptions, reqOptions);

    log.info({ origin, path, url, reqId, reqHeaders }, 'HttpClient request');

    const globalAgent = getGlobalDispatcher();

    const httpResponse = await globalAgent.request({
      origin,
      path,
      method,
      headers: reqHeaders,
      ...(body ? { body } : {}),
    });
    const { statusCode, headers: resHeaders, body: resBody } = httpResponse;
    return {
      statusCode,
      resHeaders,
      json: async () => {
        const bodyJson = await resBody.json();
        log.info(
          { origin, url, reqId, statusCode, resHeaders, body: bodyJson },
          'HttpClient response'
        );
        return bodyJson;
      },
      text: async () => {
        const bodyText = await resBody.text();
        log.info(
          { origin, url, reqId, statusCode, resHeaders, body: bodyText },
          'HttpClient response'
        );
        return bodyText;
      },
    };
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

const HTTP_VERBS = {
  GET: 'GET',
  POST: 'POST',
};

module.exports = { initHttpClient, parseOptions, parsePrefixUrl, initCache };
