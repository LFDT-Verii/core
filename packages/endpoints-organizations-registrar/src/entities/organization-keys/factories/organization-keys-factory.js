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

const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const {
  KeyPurposes,
  KeyEncodings,
  KeyAlgorithms,
} = require('@verii/crypto');

const initOrganizationFactory = require('../../organizations/factories/organizations-factory');
const initKmsFactory = require('../../kms/factories/kms-factory');

const organizationKeysRepoPlugin = require('../repos/repo');

module.exports = (app) =>
  register(
    'organizationKey',
    organizationKeysRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const organization = await getOrBuild(
        'organization',
        initOrganizationFactory(app)
      );
      const kmsEntry = await getOrBuild('kmsEntry', initKmsFactory(app));
      return {
        id: '#key-1',
        purposes: [
          KeyPurposes.DLT_TRANSACTIONS,
          KeyPurposes.ISSUING_METADATA,
          KeyPurposes.EXCHANGES,
        ],
        publicKey: kmsEntry.publicJwk,
        kmsKeyId: new ObjectId(kmsEntry._id),
        algorithm: KeyAlgorithms.SECP256K1,
        encoding: KeyEncodings.HEX,
        controller: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        custodied: true,
        type: 'EcdsaSecp256k1VerificationKey2019',
        ...overrides(),
      };
    }
  );
