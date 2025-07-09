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

const env = require('env-var');
const fs = require('fs');
const { isEmpty } = require('lodash/fp');

const nodeEnv = env.get('NODE_ENV').required().asString();
const isTest = nodeEnv === 'test';
const isDev = nodeEnv === 'development';

const serverCertificateFile = env.get('SERVER_CERTIFICATE_FILE').asString();
const serverCertificateKeyFile = env
  .get('SERVER_CERTIFICATE_KEY_FILE')
  .asString();

module.exports = {
  appPort: env.get('PORT').required(!isTest).asPortNumber(),
  appHost: env.get('HOST').required(!isTest).asString(),
  logSeverity: env.get('LOG_SEVERITY').default('info').asString(),
  nodeEnv,
  isProd: nodeEnv === 'production',
  isDev,
  isTest,
  hostUrl: env.get('HOST_URL').required(!isTest).asString(),
  mongoConnection: env.get('MONGO_URI').required(!isTest).asString(),
  tlsRejectUnauthorized: env
    .get('NODE_TLS_REJECT_UNAUTHORIZED')
    .default('1')
    .asBool(),
  secret: env.get('SECRET').required(!isTest).asString(),
  serverCertificate: isEmpty(serverCertificateFile)
    ? null
    : fs.readFileSync(serverCertificateFile),
  serverCertificateKey: isEmpty(serverCertificateKeyFile)
    ? null
    : fs.readFileSync(serverCertificateKeyFile),
  requestTimeout: env.get('REQUEST_TIMEOUT').default('30000').asInt(),
  traceIdHeader: env.get('TRACE_ID_HEADER').default('x-trace-id').asString(),
  blockchainApiAudience: env
    .get('BLOCKCHAIN_API_AUDIENCE')
    .default('https://velocitynetwork.node')
    .asString(),
  rootPublicKey: env.get('ROOT_PUBLIC_KEY').required(!isTest).asString(),
  idCredentialTypes: env
    .get('IDENTITY_CREDENTIAL_TYPES')
    .default(
      [
        'IdDocument',
        'Phone',
        'Email',
        'IdDocumentV1.0',
        'DriversLicenseV1.0',
        'NationalIdCardV1.0',
        'PassportV1.0',
        'ResidentPermitV1.0',
        'EmailV1.0',
        'PhoneV1.0',
        'ProofOfAgeV1.0',
        'VerificationIdentifier',
      ].join(',')
    )
    .asArray(),
  ajvOptions: {
    removeAdditional: true,
    useDefaults: true,
    coerceTypes: 'array',
    allErrors: false,
    strictTypes: false,
  },
  validationPluginAjvOptions: {
    allErrors: true,
    useDefaults: true,
    strictSchema: 'log',
  },
  ajvFormats: [
    'uri',
    'uri-reference',
    'iri',
    'iri-reference',
    'date',
    'date-time',
    'regex',
    'email',
    'duration',
  ],
};
