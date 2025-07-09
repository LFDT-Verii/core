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
const { hexToJwkKeyTransformer } = require('@verii/jwt');
const {
  generateKeyPair,
  KeyAlgorithms,
  KeyPurposes,
} = require('@verii/crypto');
const newError = require('http-errors');
const { kebabCase, includes } = require('lodash/fp');
const {
  mapKeyResponse,
  validateNonCustodialKey,
  validateOrganizationKey,
  buildOrganizationKey,
  KeyErrorMessages,
} = require('../domains');
const { addKeyToDidDoc } = require('./add-key-to-did-doc');
const { addOperatorKeys } = require('./add-operator-keys');
const {
  resolveVerificationMethodFromByoDID,
} = require('./resolve-verification-method-byo-did');

const addKey = async (did, newKey, context) => {
  const { repos } = context;
  const organization = await repos.organizations.findOneByDid(did);

  validateNonCustodialKey(newKey);
  validateOrganizationKey(newKey);
  const body = hexToJwkKeyTransformer(newKey);
  await checkForKeyDuplication(body, organization, context);

  let kmsEntry;
  let keyPair;
  let algorithm;
  if (shouldGenerateNewKey(organization, newKey)) {
    keyPair = generateKeyPair({ format: 'jwk' });
    kmsEntry = await context.kms.importKey({
      ...keyPair,
      algorithm: 'ec',
      curve: 'secp256k1',
    });
    algorithm = KeyAlgorithms.SECP256K1;
  }

  const kidFragment = defaultKidFragment(newKey);
  const verificationMethod = isDIDDocumentCustodied(organization)
    ? await addKeyToDidDoc(
        {
          organization,
          kidFragment,
          publicKey: shouldGenerateNewKey(organization, newKey)
            ? keyPair.publicKey
            : body.publicKey,
        },
        context
      )
    : await resolveVerificationMethodFromByoDID(
        organization.didDoc.id,
        kidFragment
      );

  const newOrganizationKey = buildOrganizationKey(
    organization._id,
    organization.didDoc.id,
    {
      purposes: body.purposes,
      algorithm: algorithm ?? body.algorithm,
      custodied: newKey.custodied,
      kmsKeyId: kmsEntry?.id,
      verificationMethod,
    }
  );

  await repos.organizationKeys.insert(newOrganizationKey);

  if (includes(KeyPurposes.DLT_TRANSACTIONS, newOrganizationKey.purposes)) {
    await addOperatorKeys(
      {
        organization,
        primaryAccount: organization.ids.ethereumAccount,
        dltKeys: [newOrganizationKey],
      },
      context
    );
  }
  return {
    key: mapKeyResponse(newOrganizationKey, keyPair),
  };
};

const checkForKeyDuplication = async (key, organization, { repos }) => {
  const ors = [
    {
      id: key.kidFragment,
    },
  ];
  if (key.publicKey) {
    ors.push({
      'publicKey.kty': key.publicKey.kty,
      'publicKey.crv': key.publicKey.crv,
      'publicKey.x': key.publicKey.x,
      'publicKey.y': key.publicKey.y,
    });
  }
  const existingOrganizationKey = await repos.organizationKeys.findOne({
    filter: {
      organizationId: organization._id,
      $or: ors,
    },
  });

  if (existingOrganizationKey != null) {
    throw newError(
      409,
      buildDuplicateKeyErrorString(key, existingOrganizationKey)
    );
  }
};

const defaultKidFragment = (body) => {
  if (!body.kidFragment) {
    return `#${kebabCase(body.purposes[0])}-${Date.now()}`;
  }

  return body.kidFragment;
};

const buildDuplicateKeyErrorString = (key, existingKey) => {
  if (key.kidFragment === existingKey.id) {
    return KeyErrorMessages.KEY_WITH_ID_FRAGMENT_ALREADY_EXISTS_TEMPLATE(key);
  }
  return KeyErrorMessages.PUBLIC_KEY_ALREADY_EXISTS_TEMPLATE(key);
};

const shouldGenerateNewKey = (organization, newKey) =>
  isDIDDocumentCustodied(organization) && newKey.publicKey == null;

const isDIDDocumentCustodied = (organization) => !organization.didNotCustodied;

module.exports = { addKey };
