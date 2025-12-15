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
const { genericConfig, abi } = require('@verii/config');
const packageJson = require('../../package.json');

const { isTest } = genericConfig;

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
  ...swaggerConfig,
  customFastifyOptions: {
    bodyLimit: 8388608,
  },
  contractAbi: abi,
  enableHttp2: env.get('ENABLE_HTTP2').default('false').asBoolStrict(),
  mongoSecret: env.get('MONGO_SECRET').required(!isTest).asString(),
  oracleUrl: env.get('REGISTRAR_URL').required(!isTest).asString(),
  libUrl: env.get('LIB_URL').required(!isTest).asString(),
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
    .required(!isTest)
    .asString(),
  revocationContractAddress: env
    .get('REVOCATION_CONTRACT_ADDRESS')
    .required(!isTest)
    .default('0xf755E1Ca66bE12F177178E7Ea696969E0A55Bb64')
    .asString(),
  rpcUrl: env
    .get('RPC_NODE_URL')
    .required()
    .default('http://34.244.131.79:8547')
    .asString(),
  chainId: env.get('CHAIN_ID').default(2020).asInt(),
  secret: env.get('SECRET').required(!isTest).asString(),
  vnfClientId: env.get('VNF_OAUTH_CLIENT_ID').required(!isTest).asString(),
  vnfClientSecret: env
    .get('VNF_OAUTH_CLIENT_SECRET')
    .required(!isTest)
    .asString(),
  vnfOAuthTokensEndpoint: env
    .get('VNF_OAUTH_TOKENS_ENDPOINT')
    .required(!isTest)
    .asString(),
  universalResolverUrl: env
    .get('UNIVERSAL_RESOLVER_URL')
    .default('https://dev.uniresolver.io/')
    .asString(),
  version: packageJson.version,
  caoDid: env.get('CAO_DID').required(!isTest).asString(),
  validateCaoDid: env.get('VALIDATE_CAO_DID').default('true').asBool(),
  sentryDsn: env.get('SENTRY_DSN').default('').asString(),
  enableProfiling: env.get('ENABLE_PROFILING').default('false').asBool(),
  enableSentryDebug: env.get('ENABLE_SENTRY_DEBUG').default('false').asBool(),
  deepLinkProtocol: env.get('DEEP_LINK_PROTOCOL').required().asString(),
  oidcTokensExpireIn: env.get('OIDC_TOKENS_EXPIRE_IN').asInt(),
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
    .default('https://www.w3.org/2018/credentials/v1')
    .asString(),
  enablePresentationContextValidation: env
    .get('ENABLE_PRESENTATION_CONTEXT_VALIDATION')
    .default('false')
    .asBool(),
  trustedIssuerCheckMinDate: env
    .get('TRUSTED_ISSUER_CHECK_MIN_DATE')
    .default('2024-02-28T00:00:00Z')
    .asString(),
  enableDeactivatedDisclosure: env
    .get('ENABLE_DEACTIVATED_DISCLOSURE')
    .default('true')
    .asBool(),
  vnfDid: env.get('VNF_DID').required().asString(),
  defaultWalletMobile: env
    .get('DEFAULT_WALLET_MOBILE')
    .required(!isTest)
    .asString(),
  defaultWalletDesktop: env
    .get('DEFAULT_WALLET_DESKTOP')
    .required(!isTest)
    .asString(),
  defaultCaWalletConfig: env
    .get('DEFAULT_CA_WALLET_CONFIG')
    .required(!isTest)
    .asJsonObject(),
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
