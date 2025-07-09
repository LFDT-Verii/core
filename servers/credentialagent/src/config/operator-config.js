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
const { merge } = require('lodash/fp');
const { coreConfig } = require('./core-config');

const operatorSwaggerConfig = {
  swaggerInfo: merge(coreConfig.swaggerInfo, {
    info: {
      title: 'Credential Agent Operator Openapi',
      description: 'APIs for operators',
    },
    tags: [
      { name: 'tenants', description: 'Operator tenants' },
      { name: 'disclosures', description: 'Operator disclosures' },
      {
        name: 'users',
        description: 'Operator authenticated users',
      },
      {
        name: 'credentials',
        description: 'Operator issued credentials',
      },
      {
        name: 'offer-exchanges',
        description: 'Operator issuing exchanges & offers',
      },
      {
        name: 'verification',
        description: 'Operator presentation verification',
      },
    ],
  }),
};

const operatorConfig = {
  ...coreConfig,
  ...operatorSwaggerConfig,
  adminUserName: env
    .get('ADMIN_USER_NAME')
    .required(!coreConfig.isTest)
    .asString(),
  vcApiEnabled: env.get('VC_API_ENABLED').default('false').asBool(),
  vendorCredentialsIncludeIssuedClaim: env
    .get('VENDOR_CREDENTIALS_INCLUDE_ISSUED_CLAIM')
    .default('false')
    .asBool(),
};

module.exports = { operatorConfig };
