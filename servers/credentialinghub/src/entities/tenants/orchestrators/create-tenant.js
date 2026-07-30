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

const { KeyPurposes, KeyEncodings } = require('@verii/crypto');
const { flatMap, flow, fromPairs, map, pick } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { nanoid } = require('nanoid');
const {
  loadPrimaryAccount,
  normalizeTenantKey,
  validateTenantKeys,
  getKeyWithPurpose,
  CihKeyPurposes,
} = require('../../keys');
const { loadTenantDidDoc, loadTenantProfile } = require('../adapters');
const { validateNewTenant } = require('../domain');
const { applyOperatorCaoDid } = require('../domain/operator-tenant-scope');

const createTenant = async (newTenant, tenantKeys, context) => {
  const { repos, kms } = context;
  const scopedNewTenant = applyOperatorCaoDid(newTenant, context);

  const [didDoc, orgProfile] = await Promise.all([
    loadTenantDidDoc(scopedNewTenant.did, context),
    loadTenantProfile(scopedNewTenant.did, context),
  ]);

  validateNewTenant(scopedNewTenant, orgProfile);

  validateTenantKeys(tenantKeys, didDoc);
  const normalizedKeys = [
    generateAccessTokenSecret(CihKeyPurposes.HOLDER_ACCESS_TOKENS),
  ].concat(map(normalizeTenantKey, tenantKeys));
  const primaryAccount = await resolvePrimaryAccount(
    scopedNewTenant,
    normalizedKeys,
    context,
  );

  const preparedTenant = await prepareTenant(
    scopedNewTenant,
    normalizedKeys,
    primaryAccount,
    context,
  );
  // eslint-disable-next-line better-mutation/no-mutation
  context.tenant = preparedTenant;
  const keys = await Promise.all(
    map((normalizedKey) => kms.importKey(normalizedKey), normalizedKeys),
  );

  const tenant = await repos.tenants.insertTenant(preparedTenant);

  return {
    tenant,
    keyMetadatas: keys.slice(1),
  };
};

const resolvePrimaryAccount = async (newTenant, keys, context) => {
  if (newTenant.primaryAccount != null) {
    return newTenant.primaryAccount;
  }
  const dltKey = getKeyWithPurpose(KeyPurposes.DLT_TRANSACTIONS, keys);
  return loadPrimaryAccount(dltKey, context);
};

/* eslint-disable better-mutation/no-mutation */
const prepareTenant = async (
  newTenant,
  normalizedKeys,
  primaryAccount,
  context,
) => {
  newTenant._id = new ObjectId();
  newTenant.primaryAccount = primaryAccount;
  if (newTenant.hostUrl == null) {
    newTenant.hostUrl = context.config.hostUrl;
  }
  newTenant.keysByPurpose = flow(
    flatMap((key) => {
      const keyMetadata = pick(
        ['_id', 'kidFragment', 'algorithm', 'encoding', 'publicJwk'],
        key,
      );
      return map((purpose) => [purpose, keyMetadata], key.purposes);
    }),
    fromPairs,
  )(normalizedKeys);
  return newTenant;
};
/* eslint-enable */

const generateAccessTokenSecret = (purpose) => ({
  _id: new ObjectId(),
  purposes: [purpose],
  encoding: KeyEncodings.BASE64URL,
  secret: nanoid(16),
});

module.exports = { createTenant };
