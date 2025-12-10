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

const { initMetadataRegistry } = require('@verii/metadata-registration');
const { jsonLdToUnsignedVcJwtContent, hexFromJwk } = require('@verii/jwt');
const { KeyAlgorithms, initCallWithKmsKey } = require('@verii/crypto');
const { buildIssuerVcUrl } = require('./build-issuer-vc-url');

/** @import { Issuer, CredentialMetadata, Context } from "../../types/types" */
/**
 * Creates a createCredentialMetadataEntry function
 * @param {Issuer} issuer the issuer
 * @param {Context} context the context
 * @returns {Promise<{
 *    addEntry: function(CredentialMetadata): Promise<void>,
 *    createList: function(number, string): Promise<boolean>
 *    }>} the contract interface to create metadata
 */
const initCredentialMetadataContract = async (issuer, context) => {
  const { config, rpcProvider, caoDid } = context;

  const credentialMetadataRegistry = await initCallWithKmsKey(context)(
    issuer.dltOperatorKMSKeyId,
    ({ privateJwk: dltJwk }) =>
      initMetadataRegistry(
        {
          privateKey: hexFromJwk(dltJwk),
          contractAddress: config.metadataRegistryContractAddress,
          rpcProvider,
        },
        context
      )
  );

  return {
    /**
     * Anchor credential metadata to the dlt
     * @param {CredentialMetadata} metadata the credential metadata
     * @returns {Promise<boolean>} true if entry is set
     */
    addEntry: (metadata) =>
      credentialMetadataRegistry.addCredentialMetadataEntry(
        metadata,
        metadata.contentHash,
        caoDid,
        metadata.algType
      ),
    /**
     * List to create on the dlt
     * @param {number} listId list id to create
     * @param {string} algType the alg type
     * @returns {Promise<boolean>} true if a list was created, false if it already existed
     */
    createList: async (listId, algType) => {
      const accountId = issuer.dltPrimaryAddress;
      const { payload, header } = jsonLdToUnsignedVcJwtContent(
        {
          id: buildIssuerVcUrl(listId, issuer, context),
          type: ['CredentialMetadataListHeader'],
          issuer: issuer.did,
          issuanceDate: new Date().toISOString(),
          credentialSubject: { listId, accountId },
        },
        KeyAlgorithms.SECP256K1,
        issuer.issuingServiceDIDKeyId
      );

      const issuerVC = await context.kms.signJwt(
        payload,
        issuer.issuingServiceKMSKeyId,
        header
      );

      return credentialMetadataRegistry.createCredentialMetadataList(
        accountId,
        listId,
        issuerVC,
        caoDid,
        algType
      );
    },
  };
};

module.exports = { initCredentialMetadataContract };
