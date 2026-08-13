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
const { jsonLdToUnsignedVcJwtContent } = require('@verii/jwt');
const { KeyAlgorithms, initCallWithKmsKey } = require('@verii/crypto');
const { toLower } = require('lodash/fp');
const { buildIssuerVcUrl } = require('./build-issuer-vc-url');

/** @import { Issuer, CredentialMetadata, Context } from "../../types/types" */
/**
 * Creates a createCredentialMetadataEntry function
 * @param {Issuer} issuer the issuer
 * @param {Context} context the context
 * @returns {Promise<{
 *    addEntry: function(CredentialMetadata): Promise<void>,
 *    createList: function(number, string): Promise<boolean>,
 *    readEntry: function(CredentialMetadata): Promise<object | undefined>
 *    }>} the contract interface to create metadata
 */
const initCredentialMetadataContract = async (issuer, context) => {
  const { config, rpcProvider, caoDid } = context;

  const credentialMetadataRegistry = await initCallWithKmsKey(context)(
    issuer.dltOperatorKMSKeyId,
    ({ privateJwk: dltJwk }) =>
      initMetadataRegistry(
        {
          privateKey: dltJwk,
          contractAddress: config.metadataRegistryContractAddress,
          rpcProvider,
        },
        context,
      ),
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
        metadata.algType,
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
        issuer.issuingServiceDIDKeyId,
      );

      const issuerVC = await context.kms.signJwt(
        payload,
        issuer.issuingServiceKMSKeyId,
        header,
      );

      return credentialMetadataRegistry.createCredentialMetadataList(
        accountId,
        listId,
        issuerVC,
        caoDid,
        algType,
      );
    },
    /**
     * Reads a free credential metadata entry back from the DLT.
     * @param {CredentialMetadata} metadata the anchored credential metadata
     * @returns {Promise<object | undefined>} the resolved public key when the contract supports a free read
     */
    readEntry: async (metadata) => {
      if (!(await supportsReadBack(credentialMetadataRegistry, metadata))) {
        return undefined;
      }

      const credentialId =
        metadata.credentialId ?? buildCredentialId(metadata, issuer, context);
      const { didDocument, didResolutionMetadata } =
        await credentialMetadataRegistry.resolveDidDocument({
          burnerDid: issuer.did,
          caoDid,
          credentials: [
            {
              contentHash: metadata.contentHash,
              credentialType: metadata.credentialType,
              id: credentialId,
            },
          ],
          did: credentialId,
        });
      if (didResolutionMetadata?.error != null) {
        throw new Error(
          `Credential metadata could not be read for ${credentialId}`,
        );
      }
      return didDocument.publicKey?.[0];
    },
  };
};

/**
 * Checks whether the registry can resolve a metadata entry without spending a coupon.
 * @param {object} metadataRegistry the initialized metadata registry
 * @param {CredentialMetadata} metadata the credential metadata to resolve
 * @returns {Promise<boolean>} whether free read-back is supported
 */
const supportsReadBack = async (metadataRegistry, metadata) => {
  const supportsResolution = [
    metadataRegistry.isFreeCredentialType,
    metadataRegistry.resolveDidDocument,
  ].every((method) => method != null);
  if (!supportsResolution) {
    return false;
  }
  return metadataRegistry.isFreeCredentialType(metadata.credentialType);
};

/**
 * Reconstructs the Velocity metadata DID for legacy entries without a stored id.
 * @param {CredentialMetadata} metadata the credential metadata
 * @param {Issuer} issuer the issuer
 * @param {Context} context the context
 * @returns {string} the credential metadata DID
 */
const buildCredentialId = (metadata, issuer, context) => {
  const id = `did:velocity:v2:${toLower(issuer.dltPrimaryAddress)}:${
    metadata.listId
  }:${metadata.index}`;
  return context.config.includeContentHashInCredentialId === true
    ? `${id}:${metadata.contentHash}`
    : id;
};

module.exports = { initCredentialMetadataContract };
