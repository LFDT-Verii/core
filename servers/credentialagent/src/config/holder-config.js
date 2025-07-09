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
const { isEmpty, merge, values } = require('lodash/fp');
const { OfferType } = require('../entities');
const { coreConfig } = require('./core-config');

const caCertificateFile = env.get('CA_CERTIFICATE_FILE').asString();
const clientCertificateFile = env.get('CLIENT_CERTIFICATE_FILE').asString();

const holderSwaggerConfig = {
  swaggerInfo: merge(coreConfig.swaggerInfo, {
    info: {
      title: 'Credential Agent Holder APIs Openapi',
      description: 'Set of APIs for holders to retrieve and share creds',
    },
    tags: [
      { name: 'issuing', description: 'Holder credential issuing' },
      {
        name: 'presentations',
        description: 'Holder presentation sharing',
      },
      {
        name: 'common',
        description: 'Holder common endpoints for issuing and presentations',
      },
      {
        name: 'utilities',
        description: 'Healthcheck and testing utilities',
      },
    ],
  }),
};

const holderConfig = {
  ...coreConfig,
  ...holderSwaggerConfig,
  identifyWebhookVersion: env
    .get('IDENTIFY_WEBHOOK_VERSION')
    .default(2)
    .asIntPositive(),
  vendorVersion: env.get('VENDOR_VERSION').default(0.6).asFloat(),
  autocleanFinalizedOfferPii: env
    .get('AUTOCLEAN_FINALIZED_OFFER_PII')
    .default('false')
    .asBool(),
  triggerOffersAcceptedWebhook: env
    .get('TRIGGER_OFFERS_ACCEPTED_WEBHOOK')
    .default('false')
    .asBool(),
  appRedirectLogoFallbackUrl: env
    .get('APP_REDIRECT_LOGO_FALLBACK_URL')
    .default('https://docs.velocitycareerlabs.io/Logos/velocity-white.png')
    .asString(),
  credentialSubjectContext: env
    .get('CREDENTIAL_SUBJECT_CONTEXT')
    .default('false')
    .asBool(),

  // vendor webhooks bearer (api) token auth
  bearerToken: env.get('BEARER_TOKEN').asString(),

  // vendor webhooks client certificate auth
  caCertificate: isEmpty(caCertificateFile)
    ? env.get('CA_CERTIFICATE').asString()
    : fs.readFileSync(caCertificateFile),
  clientCertificate: isEmpty(clientCertificateFile)
    ? undefined
    : fs.readFileSync(clientCertificateFile),
  clientCertificatePassword: env.get('CLIENT_CERTIFICATE_PASS').asString(),

  // vendor webhooks oauth
  clientId: env.get('OAUTH_CLIENT_ID').default('').asString(),
  clientSecret: env.get('OAUTH_CLIENT_SECRET').default('').asString(),
  tokensEndpoint: env.get('OAUTH_TOKENS_ENDPOINT').default('').asString(),
  scopes: env.get('OAUTH_SCOPES').default('').asString(),
  offerType: env.get('OFFER_TYPE').default('LEGACY').asEnum(values(OfferType)),
  autoIdentityCheck: env.get('AUTO_IDENTITY_CHECK').default('true').asBool(),
  errorOnInvalidWebhookOffers: env
    .get('ERROR_ON_INVALID_WEBHOOK_OFFERS')
    .default('false')
    .asBool(),
  defaultOAuthTokenExpiration: env
    .get('DEFAULT_OAUTH_TOKEN_EXPIRATION')
    .default('10080m')
    .asString(),
};

module.exports = { holderConfig };
