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
const { nanoid } = require('nanoid');

const VNF_GROUP_ID_CLAIM = 'http://velocitynetwork.foundation/groupId';
const DEFAULT_GROUP_ID = 'did:test:1234';

const testRegistrarSuperUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'admin:organizations admin:credentialTypes',
};

const testNoGroupRegistrarUser = {
  sub: `auth0|${nanoid()}`,
  scope:
    'write:organizations read:organizations write:users read:users write:credentialTypes read:credentialTypes',
};

const testRegistrarUser = {
  sub: `auth0|${nanoid()}`,
  scope:
    'write:organizations read:organizations write:users read:users write:credentialTypes read:credentialTypes',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testIAMSuperUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'admin:users',
};

const testWriteIAMUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'write:users',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testReadIAMUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'read:users',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testWriteOrganizationsUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'write:organizations',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testReadOrganizationsUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'read:organizations',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testPurchaseCouponsUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'purchase:coupons',
  [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
};

const testAdminPayMethodsUser = {
  sub: `auth0|${nanoid()}`,
  scope: 'admin:pay_methods',
};

module.exports = {
  testRegistrarUser,
  testRegistrarSuperUser,
  testNoGroupRegistrarUser,
  testWriteOrganizationsUser,
  testPurchaseCouponsUser,
  testIAMSuperUser,
  testWriteIAMUser,
  testReadIAMUser,
  testReadOrganizationsUser,
  testAdminPayMethodsUser,
  DEFAULT_GROUP_ID,
};
