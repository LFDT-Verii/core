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
const { isObject } = require('lodash');

const initCache = () => undefined;

const initHttpClient = (options = {}) => {
  const { prefixUrl, bearerToken } = options;
  const { traceIdHeader, customHeaders } = parseOptions(options);

  const presetHost = prefixUrl != null ? parsePrefixUrl(prefixUrl) : undefined;

  const defaultReqHeaders = {
    ...customHeaders,
    ...buildBearerAuthorizationHeader(bearerToken),
  };

  const request = async (
    url,
    reqOptions,
    method,
    host,
    context,
    body,
    contentType,
  ) => {
    const { traceId, log = {} } = context ?? {};
    const reqId = nanoid();
    const reqHeaders = buildReqHeaders(
      defaultReqHeaders,
      traceIdHeader,
      reqOptions,
      contentType,
      traceId,
    );
    const [origin, path] = buildUrl(host, url, reqOptions);
    const fullUrl = `${origin}${path}`;

    log.info?.({ origin, path, url, reqId, reqHeaders }, 'HttpClient request');

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: reqHeaders,
        body,
      });
      const resHeaders = Object.fromEntries(response.headers.entries());

      await assertSuccessfulResponse(response, resHeaders, {
        fullUrl,
        log,
        origin,
        reqId,
        url,
      });

      return {
        rawBody: response,
        statusCode: response.status,
        resHeaders,
        json: async () => {
          try {
            const bodyJson = await response.clone().json();
            log.info?.(
              {
                origin,
                url,
                reqId,
                statusCode: response.status,
                resHeaders,
                body: bodyJson,
              },
              'HttpClient response',
            );
            return bodyJson;
          } catch (error) {
            log.error?.(
              {
                origin,
                url,
                reqId,
                statusCode: response.status,
                resHeaders,
                error,
              },
              'JSON parsing error',
            );

            return {};
          }
        },
        text: async () => {
          const bodyText = await response.clone().text();
          log.info?.(
            {
              origin,
              url,
              reqId,
              statusCode: response.status,
              resHeaders,
              body: bodyText,
            },
            'HttpClient response',
          );
          return bodyText;
        },
      };
    } catch (error) {
      throw enrichError(error, fullUrl);
    }
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
          calcContentType(payload, reqOptions?.headers),
        ),
      delete: (url, reqOptions = {}) =>
        request(url, reqOptions, HTTP_VERBS.DELETE, host, context),
      responseType: 'promise',
    };
  };
};

const parseErrorBody = async (response) => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.startsWith('application/json')) {
    try {
      return await response.clone().json();
    } catch {
      return {};
    }
  }

  if (contentType.startsWith('text/plain')) {
    return response.clone().text();
  }

  return null;
};

const buildReqHeaders = (
  defaultReqHeaders,
  traceIdHeader,
  reqOptions,
  contentType,
  traceId,
) => {
  const reqHeaders = {
    ...defaultReqHeaders,
    ...(reqOptions.headers ?? {}),
  };

  if (traceId != null) {
    reqHeaders[traceIdHeader] = traceId;
  }
  if (contentType) {
    reqHeaders['content-type'] = contentType;
  }

  return reqHeaders;
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
  throw new Error(
    `HttpClient: Expected 1 or 2 arguments, received ${args.length}`,
  );
};

const parseOptions = (options) => ({
  traceIdHeader: options.traceIdHeader ?? 'TRACE_ID',
  customHeaders: options.customHeaders ?? {},
});

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
      'HttpClient: Cannot build URL without prefixUrl or full url',
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
    reqOptions?.searchParams,
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

const assertSuccessfulResponse = async (
  response,
  resHeaders,
  { fullUrl, log, origin, reqId, url },
) => {
  if (response.status < 400) {
    return;
  }

  const errorBody = await parseErrorBody(response);
  const error = new Error('Response Error');

  error.name = 'ResponseError';
  error.code = 'UND_ERR_RESPONSE';
  error.statusCode = response.status;
  error.body = errorBody;
  error.headers = resHeaders;
  error.url = fullUrl;

  log.error?.(
    {
      origin,
      url,
      reqId,
      statusCode: response.status,
      resHeaders,
      body: errorBody,
    },
    'HttpClient response error',
  );

  throw error;
};

const enrichError = (error, url) => {
  if (error?.url != null) {
    return error;
  }

  const enrichedError = new Error(
    error?.message ?? 'HttpClient request failed',
  );
  return Object.assign(enrichedError, error, { url });
};

const HTTP_VERBS = {
  GET: 'GET',
  POST: 'POST',
  DELETE: 'DELETE',
};

module.exports = {
  initHttpClient,
  initCache,
};
