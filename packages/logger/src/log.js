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
  ]
);

const SECURITY_PATHS = [
  'Authorization',
  'access_token',
  'adminUserName',
  'auth0ClientSecret',
  'authClient.clientSecret',
  'authClients[*].clientSecret',
  'bearerToken',
  'body.access_token',
  'body.authClient.clientSecret',
  'body.authClients[*].clientSecret',
  'body.account.refreshToken',
  'body.emails[*]',
  'body.payload.create_tenant.keys.*.key',
  'body.phones[*]',
  'body.key.key',
  'body.keys[*].key',
  'body.payload.create_tenant.keys.*.key',
  'body.refresh_token',
  'body.token',
  'credentialEntries[*].secret',
  'dltPrivateKey',
  'firebasePrivateKey',
  'headers.Authorization',
  'headers.authorization',
  'keyEncryptionSecret',
  'key.key',
  'keys[*].key',
  'metadataPrivateKey',
  'mongoConnection',
  'mongoSecret',
  'privateKey',
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
];

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

const loggerProvider = ({
  nodeEnv,
  logSeverity,
  traceIdHeader,
  version,
  destination,
}) => {
  // adds logging of the traceId if its on the request
  const serializers = {
    req: (req) => ({
      method: req.method,
      url: req.url,
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
  redact.paths =
    /^debug$/i.test(logSeverity) && nodeEnv === 'dev'
      ? SPAM_PATHS
      : [...SPAM_PATHS, ...SECURITY_PATHS, ...JSON_VC_PATHS];
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
    destination ?? prettyPrint(nodeEnv)
  );
};

module.exports = { loggerProvider };
