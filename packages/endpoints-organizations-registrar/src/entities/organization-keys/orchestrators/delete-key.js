/*
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
 *
 */
const {
  toRelativeServiceId,
  removeKeyFromDidDoc,
} = require('@verii/did-doc');
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const { includes } = require('lodash/fp');
const { KeyPurposes } = require('@verii/crypto');
const { hexFromJwk } = require('@verii/jwt');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const {
  initPermissionsContract,
} = require('../../../helpers/init-permissions-contract');

const deleteKey = async (did, keyId, context) => {
  const { repos, log } = context;

  const organization = await repos.organizations.findOneByDid(did, {
    didDoc: 1,
    ids: 1,
    didNotCustodied: 1,
  });

  const relativeKeyId = toRelativeServiceId(keyId);
  const organizationKey = await repos.organizationKeys.findOne({
    filter: {
      id: relativeKeyId,
      organizationId: new ObjectId(organization._id),
    },
  });

  if (!organizationKey) {
    throw new newError.NotFound(
      `Key ${relativeKeyId} was not found in organization ${did}`
    );
  }
  if (includes(organizationKey.purposes, KeyPurposes.ISSUING_METADATA)) {
    throw new newError.BadRequest('ISSUING_METADATA Key may not be removed');
  }

  // Update DID Document
  await removeOperatorKeyFromBlockchain(organizationKey, organization, context);

  await repos.organizationKeys.delUsingFilter({
    filter: {
      id: relativeKeyId,
      organizationId: new ObjectId(organization._id),
    },
  });

  if (!organization.didNotCustodied) {
    const { didDoc } = removeKeyFromDidDoc({
      didDoc: organization.didDoc,
      keyId: relativeKeyId,
    });

    await repos.organizations.update(organization._id, {
      didDoc,
    });
  }

  log.info({ keyId }, 'Remove key');
};

const removeOperatorKeyFromBlockchain = async (key, organization, context) => {
  if (!key.purposes.includes(KeyPurposes.DLT_TRANSACTIONS)) {
    return;
  }
  const permissionContract = await initPermissionsContract(
    organization,
    context
  );

  await permissionContract.removeOperatorKey({
    primary: organization.ids.ethereumAccount,
    operator: toEthereumAddress(hexFromJwk(key.publicKey, false)),
  });
};

module.exports = { deleteKey };
