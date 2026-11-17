/**
 * Copyright 2026 Velocity Team
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

const { toLower } = require('lodash/fp');
const { generateAccount } = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');
const { get2BytesHash } = require('@verii/crypto');
const { initMetadataRegistry } = require('@verii/metadata-registration');
const {
  deployMetadataContract,
  deployPermissionContract,
  deployRevocationContract,
  deployVerificationCouponContract,
  deployerPrivateKey,
  rpcProvider,
} = require('@verii/metadata-registration/test/helpers/deploy-contracts');

const ISSUER_SCOPES = [
  'transactions:write',
  'credential:issue',
  'credential:contactissue',
];

/**
 * Deploys the Verii ledger contracts to the local Besu node and registers a
 * primary/operator pair that may anchor free credential types.
 * @param {string[]} freeCredentialTypes credential types that need no coupon
 * @param {object} context the test context with a logger
 * @returns {Promise<object>} the contract config, accounts and rpc provider
 */
const deployDidVelocityLedger = async (freeCredentialTypes, context) => {
  const permissionsAddress = await deployPermissionContract();
  const couponContractAddress = await deployVerificationCouponContract(
    permissionsAddress,
    context,
  );
  const metadataRegistryContractAddress = await deployMetadataContract(
    freeCredentialTypes,
    couponContractAddress,
    permissionsAddress,
    context,
  );
  const revocationContractAddress = await deployRevocationContract(
    permissionsAddress,
    context,
  );
  const { primary, operator } = await registerIssuerAccounts(
    permissionsAddress,
    context,
  );

  return {
    config: {
      couponContractAddress,
      metadataRegistryContractAddress,
      revocationContractAddress,
    },
    operator,
    primary,
    rpcProvider,
  };
};

/**
 * Anchors one credential metadata list and its entries, then returns the
 * did:velocity credential ids that a verifier resolves against the ledger.
 * @param {object} ledger the ledger returned by deployDidVelocityLedger
 * @param {object} list the list to anchor
 * @param {number} list.listId the list id
 * @param {string} list.issuerVc the issuer VC bound to the list
 * @param {string} list.algType the metadata algorithm type
 * @param {object[]} list.entries entries of { index, credentialType, publicKey, contentHash }
 * @param {object} context the test context with a logger and trace id
 * @returns {Promise<string[]>} the did:velocity credential ids in entry order
 */
const anchorCredentialMetadataList = async (
  ledger,
  { listId, issuerVc, algType, entries },
  context,
) => {
  const metadataRegistry = await initMetadataRegistry(
    {
      contractAddress: ledger.config.metadataRegistryContractAddress,
      privateKey: ledger.operator.privateKey,
      rpcProvider: ledger.rpcProvider,
    },
    context,
  );
  await metadataRegistry.createCredentialMetadataList(
    ledger.primary.address,
    listId,
    issuerVc,
    context.caoDid,
    algType,
  );

  const credentialIds = [];
  for (const entry of entries) {
    // Entries on a list are anchored sequentially to keep nonces ordered.
    // eslint-disable-next-line no-await-in-loop
    await metadataRegistry.addCredentialMetadataEntry(
      {
        credentialTypeEncoded: get2BytesHash(entry.credentialType),
        index: entry.index,
        listId,
        publicKey: entry.publicKey,
      },
      entry.contentHash,
      context.caoDid,
      algType,
    );
    credentialIds.push(
      buildDidVelocityCredentialId(ledger.primary.address, listId, entry),
    );
  }
  return credentialIds;
};

// Mirrors verii-issuing, which lowercases the primary address in credential ids.
const buildDidVelocityCredentialId = (
  primaryAddress,
  listId,
  { index, contentHash },
) =>
  `did:velocity:v2:${toLower(primaryAddress)}:${listId}:${index}:${contentHash}`;

const registerIssuerAccounts = async (permissionsAddress, context) => {
  const primary = generateAccount();
  const operator = generateAccount();
  const deployerPermissions = await initPermissions(
    {
      contractAddress: permissionsAddress,
      privateKey: deployerPrivateKey,
      rpcProvider,
    },
    context,
  );
  await deployerPermissions.addPrimary({
    permissioning: primary.address,
    primary: primary.address,
    rotation: primary.address,
  });
  for (const scope of ISSUER_SCOPES) {
    // eslint-disable-next-line no-await-in-loop
    await deployerPermissions.addAddressScope({
      address: primary.address,
      scope,
    });
  }
  const primaryPermissions = await initPermissions(
    {
      contractAddress: permissionsAddress,
      privateKey: primary.privateKey,
      rpcProvider,
    },
    context,
  );
  await primaryPermissions.addOperatorKey({
    operator: operator.address,
    primary: primary.address,
  });
  return { operator, primary };
};

module.exports = {
  anchorCredentialMetadataList,
  deployDidVelocityLedger,
};
