/**
 * Copyright 2025 Velocity Team
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
const { resolveDid } = require('@verii/common-fetchers');
const { getDidAndAliases } = require('@verii/did-doc');
const { isEmpty, map, omit, some, includes } = require('lodash/fp');
const newError = require('http-errors');
const { KeyEncodings, KeyPurposes } = require('@verii/crypto');
const { validateServiceIds } = require('../domains');
const { validateDidDocKeys } = require('../../keys/orchestrators');
const {
  addPrimaryAddressToTenant,
} = require('./add-primary-address-to-tenant');

const createTenant = async (
  { did, serviceIds, webhookUrl, keys, webhookAuth },
  context,
) => {
  const organizationDidDoc = await getOrganizationDidDoc(did, context);

  validateServiceIds(organizationDidDoc, serviceIds);
  const validatedKeys = await validateDidDocKeys(organizationDidDoc, keys);
  const dids = getDidAndAliases(organizationDidDoc);
  const insertedTenant = await context.repos.tenants.insertTenant({
    did: organizationDidDoc.id,
    dids,
    serviceIds,
    webhookUrl,
    webhookAuth,
  });

  const { _id } = insertedTenant;

  if (!isEmpty(validatedKeys)) {
    await Promise.all(
      map(
        (keyDatum) =>
          context.kms.importKey({
            ...keyDatum,
            publicKey: keyDatum.publicKey ?? omit(['d'], keyDatum.key),
            encoding: KeyEncodings.JWK,
            tenantId: _id,
          }),
        validatedKeys,
      ),
    );

    await tryingToInsertPrimaryAddress(insertedTenant, validatedKeys, context);
  }
  return insertedTenant;
};

const tryingToInsertPrimaryAddress = async (tenant, insertedKeys, context) => {
  const dltExist = some(
    ({ purposes }) => includes(KeyPurposes.DLT_TRANSACTIONS, purposes),
    insertedKeys,
  );
  if (dltExist) {
    await addPrimaryAddressToTenant(tenant, context);
  }
};

const getOrganizationDidDoc = async (did, context) => {
  const notFoundError = () =>
    newError(404, 'DID not found on the Velocity network registrar.', {
      errorCode: 'did_not_found',
    });
  try {
    const organizationDidDoc = await resolveDid(did, context);
    if (isEmpty(organizationDidDoc)) {
      throw notFoundError();
    }
    return organizationDidDoc;
  } catch {
    throw notFoundError();
  }
};

module.exports = { createTenant };
