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

const {
  createBlockchainConfig,
  genericConfig,
  networkEnv,
} = require('@verii/config');
const packageJson = require('../../package.json');

const { isTest, secret } = genericConfig;
const env = networkEnv();

const swaggerConfig = {
  swaggerInfo: {
    info: {
      version: '0.8.9',
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
  },
};
const coreConfig = {
  ...genericConfig,
  ...createBlockchainConfig(),
  ...swaggerConfig,
  customFastifyOptions: {
    bodyLimit: 8388608,
  },
  enableHttp2: env.get('ENABLE_HTTP2').default('false').asBoolStrict(),
  hostUrl: env.get('HOST_URL').required(!isTest).asString(),
  mongoSecret: env.get('MONGO_SECRET').required(!isTest).asString(),
  oracleUrl: env.get('REGISTRAR_URL').required(!isTest).asString(),
  libUrl: env.get('LIB_URL').required(!isTest).asString(),
  issuingChallengeSecret: env
    .get('ISSUING_CHALLENGE_SECRET')
    .default(secret)
    .asString(),
  universalResolverUrl: env
    .get('UNIVERSAL_RESOLVER_URL')
    .default('https://dev.uniresolver.io/')
    .asString(),
  version: packageJson.version,
  serviceName: packageJson.name,
  caoDid: env.get('CAO_DID').required(!isTest).asString(),
  validateCaoDid: env.get('VALIDATE_CAO_DID').default('true').asBool(),
  deepLinkProtocol: env.get('DEEP_LINK_PROTOCOL').required().asString(),
  oidcTokensExpireIn: env.get('OIDC_TOKENS_EXPIRE_IN').default(600).asInt(),
  enableOfferValidation: env
    .get('ENABLE_OFFER_VALIDATION')
    .default('true')
    .asBool(),
  storeIssuerAsString: env
    .get('STORE_ISSUER_AS_STRING')
    .default('false')
    .asBool(),
  credentialExtensionsContextUrl: env
    .get('CREDENTIAL_EXTENSIONS_CONTEXT_URL')
    .required(!isTest)
    .asString(),
  presentationContextValue: env
    .get('PRESENTATION_CONTEXT_VALUE')
    .default(
      [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/ns/credentials/v2',
      ].join(','),
    )
    .asArray(),
  enablePresentationContextValidation: env
    .get('ENABLE_PRESENTATION_CONTEXT_VALIDATION')
    .default('false')
    .asBool(),
  enableDeactivatedDisclosure: env
    .get('ENABLE_DEACTIVATED_DISCLOSURE')
    .default('true')
    .asBool(),
  vnfDid: env.get('VNF_DID').required().asString(),
  disclosureCredentialTypeRequired: env
    .get('DISCLOSURE_CREDENTIAL_TYPE_REQUIRED')
    .default('true')
    .asBool(),
  vendorUrl: env.get('VENDOR_URL').asString(),
  includeContentHashInCredentialId: env
    .get('INCLUDE_CONTENT_HASH_IN_CREDENTIAL_ID')
    .default('true')
    .asBool(),
};

module.exports = { coreConfig };
