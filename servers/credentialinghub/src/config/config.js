/*
 * Copyright 2024 Velocity Team
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
 *
 */
const { genericConfig } = require('@verii/config');
const { from } = require('env-var');
const { parse: parseDuration } = require('@lukeed/ms');
const {
  buildNotificationConfig,
  NotificationWorkerModes,
} = require('../entities/notifications/domain/notification-config');
const {
  DefaultNotificationEventTypes,
} = require('../entities/notifications/domain/event-types');
const {
  DEFAULT_SIGNATURE_HEADER_NAME,
} = require('../entities/notifications/domain/hmac-headers');
const {
  NotificationQueueTypes,
} = require('../entities/notifications/domain/notification-queue-types');
const packageJson = require('../../package.json');

const { isTest } = genericConfig;

const env = from(process.env, { asMs: (value) => parseDuration(value) });

const ajvConfig = {
  ajvOptions: {
    removeAdditional: false,
    useDefaults: false,
    coerceTypes: false,
    allErrors: false,
    strictTypes: 'log',
  },
};
const swaggerConfig = {
  swaggerInfo: {
    info: {
      title: 'Credential Agent v2',
      description: 'APIs for issuer and verifying verifiable credentials',
      version: '2.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      {
        name: 'utilities',
        description: 'Healthcheck and testing utilities',
      },
    ],
  },
};

const openid4vcConfig = {};
const notificationsEnabled = env
  .get('NOTIFICATIONS_ENABLED')
  .default('false')
  .asBool();
const notificationWebhookUrl = notificationsEnabled
  ? env.get('NOTIFICATIONS_WEBHOOK_URL').required().asUrlString()
  : env.get('NOTIFICATIONS_WEBHOOK_URL').asString();

module.exports = {
  ...genericConfig,
  ...ajvConfig,
  ...swaggerConfig,
  ...openid4vcConfig,
  version: packageJson.version,
  customFastifyOptions: {
    bodyLimit: 8388608,
  },
  deepLinkProtocol: env.get('DEEP_LINK_PROTOCOL').required().asString(),
  keyEncryptionSecret: env.get('KEY_ENCRYPTION_SECRET').required().asString(),
  operatorApiToken: env.get('OPERATOR_API_TOKEN').required().asString(),
  registrarUrl: env.get('REGISTRAR_URL').required().asString(),
  libUrl: env.get('LIB_URL').required().asString(),
  credentialExtensionsContextUrl: env
    .get('CREDENTIAL_EXTENSIONS_CONTEXT_URL')
    .default(
      'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
    )
    .asString(),
  challengesExpireIn: env.get('CHALLENGES_EXPIRE_IN').default('3d').asMs(),
  // blockchain setup
  rpcUrl: env
    .get('RPC_NODE_URL')
    .required()
    .default('http://34.244.131.79:8547')
    .asString(),
  chainId: env.get('CHAIN_ID').default(2020).asInt(),
  metadataRegistryContractAddress: env
    .get('METADATA_REGISTRY_CONTRACT_ADDRESS')
    .required(!isTest)
    .asString(),
  permissionsContractAddress: env
    .get('PERMISSIONS_CONTRACT_ADDRESS')
    .required()
    .asString(),
  couponContractAddress: env
    .get('COUPON_CONTRACT_ADDRESS')
    .required()
    .asString(),
  revocationContractAddress: env
    .get('REVOCATION_CONTRACT_ADDRESS')
    .required()
    .default('0xf755E1Ca66bE12F177178E7Ea696969E0A55Bb64')
    .asString(),
  defaultCaoDid: env.get('DEFAULT_CAO_DID').asString(),
  vnfClientId: env.get('VNF_OAUTH_CLIENT_ID').required().asString(),
  vnfClientSecret: env.get('VNF_OAUTH_CLIENT_SECRET').required().asString(),
  vnfOAuthTokensEndpoint: env
    .get('VNF_OAUTH_TOKENS_ENDPOINT')
    .required()
    .asString(),
  credentialSubjectContext: env
    .get('CREDENTIAL_SUBJECT_CONTEXT')
    .default('false')
    .asBool(),
  notifications: buildNotificationConfig({
    enabled: notificationsEnabled,
    queueType: env
      .get('NOTIFICATIONS_QUEUE_TYPE')
      .default(NotificationQueueTypes.MONGO)
      .asEnum(Object.values(NotificationQueueTypes)),
    workerMode: env
      .get('NOTIFICATIONS_WORKER_MODE')
      .default(NotificationWorkerModes.EMBEDDED_CHILD)
      .asEnum(Object.values(NotificationWorkerModes)),
    retentionDays: env
      .get('NOTIFICATIONS_RETENTION_DAYS')
      .default('30')
      .asIntPositive(),
    webhookUrl: notificationWebhookUrl,
    webhookEventTypes: env
      .get('NOTIFICATIONS_WEBHOOK_EVENTS')
      .default(DefaultNotificationEventTypes.join(','))
      .asArray(),
    webhookSecret: env
      .get('NOTIFICATIONS_WEBHOOK_SECRET')
      .required(notificationsEnabled)
      .asString(),
    signatureHeaderName: env
      .get('NOTIFICATIONS_WEBHOOK_SIGNATURE_HEADER_NAME')
      .default(DEFAULT_SIGNATURE_HEADER_NAME)
      .asString(),
    webhookTimeoutMs: env
      .get('NOTIFICATIONS_WEBHOOK_TIMEOUT_MS')
      .default('5000')
      .asIntPositive(),
    maxAttempts: env
      .get('NOTIFICATIONS_MAX_ATTEMPTS')
      .default('12')
      .asIntPositive(),
    maxConcurrency: env
      .get('NOTIFICATIONS_WORKER_MAX_CONCURRENCY')
      .default('4')
      .asIntPositive(),
    allowInsecureWebhookUrl: env
      .get('NOTIFICATIONS_ALLOW_INSECURE_WEBHOOK_URL')
      .default('false')
      .asBool(),
  }),
};
