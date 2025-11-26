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
  getGlobalDispatcher,
} = require('undici');
const { createOidcInterceptor } = require('undici-oidc-interceptor');
const { isObject } = require('lodash');
const pkg = require('../package.json');

const USER_AGENT_HEADER = `${pkg.name}/${pkg.version}`;

const initCache = () => new cacheStores.MemoryCacheStore();

const initHttpClient = (options) => {
  const { prefixUrl, isTest, bearerToken } = options;

  const { clientOptions, traceIdHeader, customHeaders } = parseOptions(options);

  const presetHost = prefixUrl != null ? parsePrefixUrl(prefixUrl) : undefined;

  const baseAgent = isTest ? getGlobalDispatcher() : new Agent(clientOptions);
  const agent = baseAgent.compose(buildInterceptorChain(presetHost, options));

  const defaultReqHeaders = {
    'user-agent': USER_AGENT_HEADER,
    ...customHeaders,
    ...buildBearerAuthorizationHeader(bearerToken),
  };

  const request = async (
    url,
    reqOptions,
    method,
    host,
    { traceId, log },
    body,
    contentType
  ) => {
    const reqId = nanoid();
    const reqHeaders = buildReqHeaders(reqOptions, contentType, traceId);
    const [origin, path] = buildUrl(host, url, reqOptions);

    log.info({ origin, path, url, reqId, reqHeaders }, 'HttpClient request');

    try {
      const httpRequest = {
        origin,
        path,
        method,
        headers: reqHeaders,
      };
      if (body) {
        httpRequest.body = body;
      }
      const httpResponse = await agent.request(httpRequest);
      const { statusCode, headers: resHeaders, body: rawBody } = httpResponse;
      return {
        rawBody,
        statusCode,
        resHeaders,
        json: async () => {
          try {
            const bodyJson = await rawBody.json();
            log.info(
              { origin, url, reqId, statusCode, resHeaders, body: bodyJson },
              'HttpClient response'
            );
            return bodyJson;
          } catch (error) {
            log.error(
              { origin, url, reqId, statusCode, resHeaders, error },
              'JSON parsing error'
            );

            return {};
          }
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
      error.url = `${origin}${path}`;

      throw error;
    }
  };

  const buildReqHeaders = (reqOptions, contentType, traceId) => {
    const reqHeaders = {
      ...defaultReqHeaders,
      ...(reqOptions.headers ?? {}),
      [traceIdHeader]: traceId,
    };
    if (contentType) {
      reqHeaders['content-type'] = contentType;
    }
    return reqHeaders;
  };

  return (...args) => {
    const { host, context } = parseArgs(presetHost, args);
    return {
      get: (url, reqOptions = {}) =>
        request(url, reqOptions, HTTP_VERBS.GET, host, context),
      post: (url, payload, reqOptions = {}) =>
        request(
          url,
          reqOptions,
          HTTP_VERBS.POST,
          host,
          context,
          isObject(payload) ? JSON.stringify(payload) : payload,
          calcContentType(payload, reqOptions?.headers)
        ),
      delete: (url, reqOptions = {}) =>
        request(url, reqOptions, HTTP_VERBS.DELETE, host, context),
      responseType: 'promise',
    };
  };
};

const calcContentType = (payload, headers = {}) =>
  isObject(payload) && !headers['content-type']
    ? 'application/json'
    : headers['content-type'];

const parseArgs = (presetHost, args) => {
  if (args.length === 1) {
    return { host: presetHost, context: args[0] };
  }
  if (args.length === 2) {
    return { host: parsePrefixUrl(args[0]), context: args[1] };
  }
  throw new Error(`HttpClient: Expected 1 or 2 arguments, received ${args.length}`);
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

const buildInterceptorChain = (
  host,
  {
    isTest,
    cache: cacheStore,
    tokensEndpoint,
    clientId,
    clientSecret,
    scopes,
    audience,
  }
) => {
  const chain = [];
  if (!isTest) {
    chain.push(
      interceptors.dns({ maxTTL: 300000, maxItems: 2000, dualStack: false })
    );
  }

  chain.push(interceptors.responseError());

  if (cacheStore != null) {
    chain.push(interceptors.cache({ store: cacheStore, methods: ['GET'] }));
  }

  if (tokensEndpoint && host != null) {
    const oidcInterceptor = createOidcInterceptor({
      idpTokenUrl: tokensEndpoint,
      clientId,
      clientSecret,
      retryOnStatusCodes: [401],
      scope: scopes,
      audience,
      urls: [host.origin],
    });
    chain.push(oidcInterceptor);
  }

  return chain;
};

const parsePrefixUrl = (prefixUrl) => {
  const url = new URL(prefixUrl);
  return {
    origin: url.origin,
    rootPath:
      url.pathname.at(-1) === '/' ? url.pathname.slice(0, -1) : url.pathname,
  };
};

const buildUrl = (host, url, reqOptions) => {
  if (/https?:\/\//.test(url)) {
    return parseFullURL(url, reqOptions);
  }
  if (!host) {
    throw new Error(
      'HttpClient: Cannot build URL without prefixUrl or full url'
    );
  }
  return [host.origin, buildRelativePath(host.rootPath ?? '', url, reqOptions)];
};

const parseFullURL = (url, reqOptions) => {
  const { origin, pathname, searchParams } = new URL(url);
  return [
    origin,
    addSearchParams(pathname, searchParams, reqOptions?.searchParams),
  ];
};

const buildRelativePath = (rootPath, url, reqOptions) => {
  const relativePath = `${rootPath}${url.charAt(0) === '/' ? '' : '/'}${url}`;
  const [pathname, searchParamsString] = relativePath.split('?');

  return addSearchParams(
    pathname,
    new URLSearchParams(searchParamsString),
    reqOptions?.searchParams
  );
};

const addSearchParams = (path, searchParams, additionalParams) => {
  const params = additionalParams?.size
    ? new URLSearchParams([
        ...Array.from(searchParams.entries()),
        ...Array.from(additionalParams.entries()),
      ])
    : searchParams;
  return params?.size ? `${path}?${params}` : path;
};

const buildBearerAuthorizationHeader = (token) =>
  token ? { Authorization: `Bearer ${token}` } : {};

const HTTP_VERBS = {
  GET: 'GET',
  POST: 'POST',
  DELETE: 'DELETE',
};

module.exports = {
  initHttpClient,
  parseOptions,
  parsePrefixUrl,
  initCache,
  buildUrl,
};
