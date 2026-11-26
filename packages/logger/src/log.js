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

const pino = require('pino');
const pretty = require('pino-pretty');
const { jwtDecode } = require('@verii/jwt');
const { customFastifyQueryStringParser } = require('@verii/rest-queries');
const { compact, split, flatMap, flow, last } = require('lodash/fp');

const SPAM_PATHS = ['contractAbi', 'body.file'];

const JSON_VC_PATHS = flatMap(
  (path) => {
    const rootPath = compact(path.split('.'));
    return [
      rootPath.concat(['credentialSubject']).join('.'),
      rootPath.concat(['relatedResource', 'id']).join('.'),
      rootPath.concat(['relatedResource[*]', 'id']).join('.'),
    ];
  },
  [
    '',
    'body',
    'body[*]',
    'body.credential',
    'body.credentials[*]',
    'body.emailCredentials[*]',
    'body.idDocumentCredentials[*]',
    'body.issuedCredentials[*]',
    'body.phoneCredentials[*]',
    'body.offer',
    'body.offers[*]',
    'credential',
    'credentialEntries[*].credential',
    'credentials[*]',
    'offer',
    'offers[*]',
  ],
);

// Credential data objects, as built by @verii/verii-verification, hold the
// decoded credential, the raw credential JWT (twice) and its content hash.
const CREDENTIAL_DATA_PATHS = flatMap(
  (root) => [
    `${root}.credential.credentialSubject`,
    `${root}.jwtVc`,
    `${root}.compact`,
    `${root}.contentHash`,
  ],
  ['credential', 'credentials[*]'],
);

const SECURITY_PATHS = [
  'Authorization',
  'access_token',
  'accessToken',
  'adminUserName',
  'auth0ClientSecret',
  'authClient.clientSecret',
  'authClients[*].clientSecret',
  'bearerToken',
  'body.access_token',
  'body.account.id_token',
  'body.authClient.clientSecret',
  'body.authClients[*].clientSecret',
  'body.authorization_code',
  'body.account.refreshToken',
  'body.emails[*]',
  'body.hexKey',
  'body.jwk.d',
  'body.payload.create_tenant.keys.*.key',
  'body.payload.create_tenant.keys.*.jwk.d',
  'body.phones[*]',
  'body["pre-authorized_code"]',
  'body.key.key',
  'body.key.jwk.d',
  'body.keys[*].key',
  'body.keys[*].jwk.d',
  'body.keys[*].hexKey',
  'body.refresh_token',
  'body.token',
  'body.tx_code',
  'body.value',
  'body.verificationCode',
  'body.vp_token',
  'credentialEntries[*].secret',
  'context.config',
  'dltPrivateKey',
  'encryptedPK',
  'event.meta.headers',
  'firebasePrivateKey',
  'headers.Authorization',
  'headers.authorization',
  'headers.Cookie',
  'headers.cookie',
  'headers.referer',
  'headers["x-firebase-appcheck"]',
  'headers["x-vcl-installation-id"]',
  'id_token',
  'keyEncryptionSecret',
  'jwk.d',
  'key.key',
  'key.jwk.d',
  'keys[*].hexKey',
  'keys[*].key',
  'keys[*].jwk.d',
  'meta.headers',
  'metadataPrivateKey',
  'mongoConnection',
  'mongoSecret',
  'privateKey',
  'refresh_token',
  'reqHeaders.Authorization',
  'reqHeaders.authorization',
  'reqHeaders.Cookie',
  'reqHeaders.cookie',
  'resHeaders["set-cookie"]',
  'revocationPrivateKey',
  'rootPrivateKey',
  'secret',
  'serverCertificate',
  'serverCertificateKey',
  'stripeSecretKey',
  'stripeWebhookEndpointSecret',
  'token',
  'vclOauthClientSecret',
  'vclServiceDeskToken',
  'vnfBrokerClientSecret',
  'vnfClientSecret',
  'yotiSecret',
  'operatorApiToken',
  'clientSecret',
  'client_secret',
  'blockchainCredentials.secretId',
  'cao.blockchainCredentials.secretId',
  'provisioningCode',
  "headers['x-provisioning-code']",
  'body.clientSecret',
  'body.client_secret',
  'body.vnfClientSecret',
  'body.blockchainCredentials.secretId',
  'body.provisioningCode',
];

// Query parameters whose values are censored in the logged request url.
// Deep links, credential offers, request uris and vendor origin contexts can
// carry a pre-authorized code, so their whole values are censored.
const SECURITY_QUERY_PARAMS = Object.freeze([
  'access_token',
  'authCode',
  'credential_offer',
  'credential_offer_uri',
  'deeplink',
  'openid4vc_uri',
  'pre-authorized_code',
  'push_delegate.push_token',
  'request_uri',
  'vendorOriginContext',
]);

// Fields of the Hub's operator API responses that carry a pre-authorized code
// or a link carrying one. Servers that call that API, and the Hub itself, add
// them to their logRedactPaths.
const HUB_CLIENT_REDACT_PATHS = Object.freeze([
  'body.openidCredentialOffer',
  'body.preauthCode',
  'body.redirectUrl',
  'body.vnProtocolLink',
]);

const prettyPrint = (nodeEnv) =>
  ['development', 'test'].includes(nodeEnv)
    ? pretty({
        colorize: true,
        translateTime: true,
        ignore: 'hostname,pid',
        sync: nodeEnv === 'test', // needed for jest being shit
      })
    : undefined;

const buildUserId = (req) => {
  const { authorization } = req.headers;
  if (authorization) {
    try {
      const { payload } = flow(split(' '), last, jwtDecode)(authorization);
      const userId = payload.sub || payload.user;
      return { userId };
    } catch {
      return {};
    }
  }
  return {};
};

// The query string starts at the first `?` or `#`, as in Fastify 5's router,
// which starts it at `;` only when useSemicolonDelimiter is on. Verii's
// servers pin it off.
// Each parameter is read with customFastifyQueryStringParser from
// @verii/rest-queries, the parser Verii's servers give Fastify, and as a
// standard URL parser does, since the server that receives an outbound url
// may use either. Its value is censored when either reading holds a value at
// or below a listed path. Array indexes are dropped, as request validation
// coerces a one-element array to its value.
const censorUrl = (url) => {
  const queryStart = url?.search(/[?#]/) ?? -1;
  if (queryStart === -1) {
    return url;
  }
  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map(censorQueryParam)
    .join('&');
  return `${url.slice(0, queryStart + 1)}${query}`;
};

// A parameter can hold a later `?` or `#` (a fragment or an unencoded url in
// its value), so a listed name after one is censored too, along with the rest
// of that parameter. Its value is censored when it holds a listed parameter
// once percent-decoded.
const censorQueryParam = (param) => {
  if (isSecurityQueryParam(param)) {
    return censorValue(param);
  }
  const pieces = param.split(/([?#])/);
  const index = pieces.findIndex(isSecurityQueryParam);
  if (index !== -1) {
    return `${pieces.slice(0, index).join('')}${censorValue(pieces[index])}`;
  }
  const valueStart = param.indexOf('=') + 1;
  return holdsEncodedSecurityQueryParam(param.slice(valueStart))
    ? `${param.slice(0, valueStart)}...shhh...`
    : param;
};

const censorValue = (param) => `${param.split('=', 1)[0]}=...shhh...`;

// Each pass decodes the whole value, so the passes are capped and a value
// still encoded after the last one is censored. A value that doesn't decode is
// kept.
const MAX_QUERY_VALUE_DECODES = 5;

const holdsEncodedSecurityQueryParam = (value) => {
  let encoded = value;
  for (let pass = 0; pass < MAX_QUERY_VALUE_DECODES; pass += 1) {
    const decoded = decodeQueryValue(encoded);
    if (decoded === encoded) {
      return false;
    }
    if (decoded.split(/[&?#]/).some(isSecurityQueryParam)) {
      return true;
    }
    encoded = decoded;
  }
  return decodeQueryValue(encoded) !== encoded;
};

const decodeQueryValue = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isSecurityQueryParam = (param) =>
  [
    ...listLeafPaths(customFastifyQueryStringParser(param)),
    ...new URLSearchParams(param).keys(),
  ].some((path) =>
    SECURITY_QUERY_PARAMS.some(
      (listed) => path === listed || path.startsWith(`${listed}.`),
    ),
  );

const listLeafPaths = (value, prefix = []) => {
  if (value == null || typeof value !== 'object') {
    return [prefix.join('.')];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    listLeafPaths(child, Array.isArray(value) ? prefix : [...prefix, key]),
  );
};

// logRedactPaths adds a server's own paths to those every server redacts.
const loggerProvider = ({
  nodeEnv,
  logSeverity,
  traceIdHeader,
  version,
  destination,
  logRedactPaths = [],
}) => {
  // adds logging of the traceId if its on the request
  const serializers = {
    req: (req) => ({
      method: req.method,
      url: censorUrl(req.url),
      version: req.headers['accept-version'],
      traceId: req.headers[traceIdHeader],
      hostname: req.hostname,
      remoteAddress: req.ip,
      remotePort: req.socket.remotePort,
      serverVersion: version,
      ...buildUserId(req),
    }),
  };
  const redact = {};
  redact.paths = [
    ...SPAM_PATHS,
    ...SECURITY_PATHS,
    ...JSON_VC_PATHS,
    ...CREDENTIAL_DATA_PATHS,
    ...logRedactPaths,
  ];
  redact.censor = (value, path) => {
    if (last(path) === 'file') {
      return '...large file...';
    }
    return '...shhh...';
  };

  return pino(
    {
      level: logSeverity,
      serializers,
      redact,
    },
    destination ?? prettyPrint(nodeEnv),
  );
};

module.exports = {
  censorUrl,
  HUB_CLIENT_REDACT_PATHS,
  loggerProvider,
  SECURITY_QUERY_PARAMS,
};
