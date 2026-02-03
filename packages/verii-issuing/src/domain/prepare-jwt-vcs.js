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

const { toLower } = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const {
  generateJWAKeyPair,
  get2BytesHash,
  KeyAlgorithms,
} = require('@verii/crypto');
const { jsonLdToUnsignedVcJwtContent, jwtSign } = require('@verii/jwt');
const { extractCredentialType } = require('@verii/vc-checks');
const { hashOffer } = require('./hash-offer');
const { buildRevocationUrl } = require('../adapters/build-revocation-url');
const { buildJsonLdCredential } = require('./build-jsonld-credential');

// eslint-disable-next-line max-len
/** @import { Issuer, AllocationListEntry, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context, JsonLdCredential } from "../types/types" */

/**
 * Builds the VCs
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {Issuer} issuer  the issuer
 * @param {AllocationListEntry[]} metadataEntries metadata entries
 * @param {AllocationListEntry[]} revocationListEntries revocation list entries
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types
 * @param {Context} context the context
 * @returns {Promise<{vcJwt: string, jsonLdCredential: JsonLdCredential, metadata: CredentialMetadata}[]>} the vc and its metadata
 */
const prepareJwtVcs = async (
  offers,
  credentialSubjectId,
  issuer,
  metadataEntries,
  revocationListEntries,
  credentialTypesMap,
  context,
) => {
  return Promise.all(
    mapWithIndex(async (offer, i) => {
      const metadataEntry = metadataEntries[i];
      const credentialType = extractCredentialType(offer);
      const digitalSignatureAlgorithm =
        credentialTypesMap[credentialType].defaultSignatureAlgorithm ??
        KeyAlgorithms.SECP256K1;

      const keyPair = generateJWAKeyPair(digitalSignatureAlgorithm);

      const metadata = {
        ...metadataEntry,
        credentialType,
        credentialTypeEncoded: get2BytesHash(credentialType), // TODO replace with bytes encoding from credentialMetadata
        contentHash: hashOffer(offer),
        publicKey: keyPair.publicKey,
      };

      const credentialId = buildVelocityCredentialMetadataDID(
        metadataEntry,
        issuer,
        metadata.contentHash,
        context.config.includeContentHashInCredentialId,
      );
      const revocationUrl = buildRevocationUrl(
        revocationListEntries[i],
        issuer,
        context,
      );
      const jsonLdCredential = buildJsonLdCredential(
        issuer,
        credentialSubjectId,
        offer,
        credentialId,
        metadata.contentHash, // TODO remove June 2026
        credentialTypesMap[metadata.credentialType],
        revocationUrl,
        context,
      );

      const { header, payload } = jsonLdToUnsignedVcJwtContent(
        jsonLdCredential,
        digitalSignatureAlgorithm,
        `${credentialId}#key-1`,
      );
      const vcJwt = await jwtSign(payload, keyPair.privateKey, header);

      return { metadata, jsonLdCredential, vcJwt };
    }, offers),
  );
};

/**
 * Builds a credential metadata DID URI
 * @param {AllocationListEntry} entry the list entry
 * @param {Issuer} issuer the issuer
 * @param {string} contentHash the content hash of the credential
 * @param {boolean} includeContentHashInCredentialId whether to include the content hash in the id
 * @returns {string} the DID URI for the location on the credential metadata list
 */
const buildVelocityCredentialMetadataDID = (
  entry,
  issuer,
  contentHash,
  includeContentHashInCredentialId,
) => {
  const id = `did:velocity:v2:${toLower(issuer.dltPrimaryAddress)}:${
    entry.listId
  }:${entry.index}`;
  if (includeContentHashInCredentialId) {
    return `${id}:${contentHash}`;
  }
  return id;
};

module.exports = { prepareJwtVcs };
