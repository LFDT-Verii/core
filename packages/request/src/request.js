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

const { every, isEmpty, some, isNil, omitBy } = require('lodash/fp');
const { addSeconds } = require('date-fns/fp');
const got = require('got');
const { nanoid } = require('nanoid/non-secure');
const pkg = require('../package.json');

const setContext =
  ({ log, traceId }) =>
  (options) => {
    // eslint-disable-next-line better-mutation/no-mutation
    options.context = omitBy(isNil)({
      log,
      traceId,
      reqId: nanoid(10),
    });
  };

const initOauth = ({
  clientId,
  clientSecret,
  tokensEndpoint,
  scopes,
  audience,
  authGot,
}) => {
  const grantType = 'client_credentials';
  const tokenExpirationSafeBuffer = 5;
  let tokensCache = null;

  const isTokenCached = () => tokensCache && tokensCache.expiresAt > new Date();

  return async (context) => {
    if (!isTokenCached()) {
      const basicAuthToken = Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64');
      const authRequest = {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
        },
        form: {
          grant_type: grantType,
          audience,
          scope: scopes,
          client_id: clientId,
          client_secret: clientSecret,
        },
      };

      const authResult = await authGot(context)
        .post(tokensEndpoint, authRequest)
        .json();

      // eslint-disable-next-line better-mutation/no-mutation
      tokensCache = {
        accessToken: authResult.access_token,
        expiresAt: addSeconds(
          authResult.expires_in - tokenExpirationSafeBuffer,
          new Date()
        ),
      };
    }

    return tokensCache.accessToken;
  };
};

const parseRawBody = (rawBodyBuffer) => {
  const rawBody = rawBodyBuffer.toString();
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

const initRequest = ({
  rejectUnauthorized,
  isProd,
  bearerToken,
  requestTimeout,
  caCertificate,
  clientCertificate,
  clientCertificatePassword,
  traceIdHeader = 'TRACE_ID',
  customHeaders = {},
  prefixUrl,
  mapUrl,
  clientId,
  clientSecret,
  audience,
  tokensEndpoint,
  scopes,
  errorResponseProp = 'gatewayResponse',
}) => {
  const gotConfig = {
    https: {
      rejectUnauthorized: rejectUnauthorized || isProd || false,
      certificateAuthority: caCertificate,
      pfx: clientCertificate,
      passphrase: clientCertificatePassword,
    },
    timeout: { request: requestTimeout, lookup: 2000 },
    headers: {
      'user-agent': `${pkg.name}/${pkg.version}`,
      ...customHeaders,
    },
    prefixUrl,
    hooks: {
      beforeRequest: [
        (options) => {
          if (!isEmpty(options.context.traceId)) {
            // eslint-disable-next-line better-mutation/no-mutation
            options.headers[traceIdHeader] = options.context.traceId;
          }
        },
      ],
      afterResponse: [
        (response) => {
          const {
            url,
            request: { options },
            statusCode,
            statusMessage,
            headers,
            rawBody,
          } = response;
          options.context.log.info(
            {
              url,
              fetchReqId: options.context.reqId,
              responseStatus: statusCode,
              responseHeaders: headers,
              body: parseRawBody(rawBody),
            },
            `Fetch Response: ${statusMessage}`
          );
          return response;
        },
      ],
      beforeError: [
        (error) => {
          if (error?.response == null) {
            return error;
          }

          const ct = error.response.headers['content-type'];
          if (/json/.test(ct) && error.response.body.message != null) {
            // eslint-disable-next-line better-mutation/no-mutation
            error.message = error.response.body.message;
          }
          // eslint-disable-next-line better-mutation/no-mutation
          error[errorResponseProp] = error.response;
          return error;
        },
      ],
    },
  };

  const buildAuthHook = () => {
    const oauthConfig = {
      clientId,
      clientSecret,
      tokensEndpoint,
    };

    const oneOfOAuthConfig = {
      scopes,
      audience,
    };
    if (
      every((v) => !isEmpty(v), oauthConfig) &&
      some((v) => !isEmpty(v), oneOfOAuthConfig)
    ) {
      const authGot = initRequest({
        rejectUnauthorized,
        isProd,
        requestTimeout,
        caCertificate,
        clientCertificate,
        clientCertificatePassword,
        traceIdHeader,
      });
      const authenticate = initOauth({
        ...oauthConfig,
        ...oneOfOAuthConfig,
        authGot,
      });

      return async (options) => {
        const authToken = await authenticate(options.context);
        // eslint-disable-next-line better-mutation/no-mutation
        options.headers.Authorization = `Bearer ${authToken}`;
      };
    }
    if (!isEmpty(bearerToken)) {
      return async (options) => {
        // eslint-disable-next-line better-mutation/no-mutation
        options.headers.Authorization = `Bearer ${bearerToken}`;
      };
    }
    return null;
  };

  // add optional hooks
  if (mapUrl != null) {
    gotConfig.hooks.beforeRequest.push((options) => {
      // eslint-disable-next-line better-mutation/no-mutation
      options.url.pathname = mapUrl(options.url.pathname);
    });
  }
  const authHook = buildAuthHook();
  if (authHook != null) {
    gotConfig.hooks.beforeRequest.push(authHook);
  }

  // add logging hook last
  gotConfig.hooks.beforeRequest.push((options) => {
    options.context.log.info(
      {
        url: options.url.href,
        headers: options.headers,
        body: options.body ?? options.json,
        fetchReqId: options.context.reqId,
      },
      'Fetch Request'
    );
  });

  const configuredGot = got.extend(gotConfig);
  return (context) =>
    configuredGot.extend({
      hooks: {
        init: [setContext(context)],
      },
    });
};

module.exports = initRequest;
