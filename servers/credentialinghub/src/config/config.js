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
};
