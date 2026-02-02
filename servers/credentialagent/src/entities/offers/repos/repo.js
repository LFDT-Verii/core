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

const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const { size, map, pick } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const {
  issuedCredentialProjection,
} = require('./issued-credential-projection');
const { cleanPiiExtension } = require('./clean-pii-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'offers',
      entityName: 'offers',
      defaultProjection: {
        _id: 1,
        '@context': 1,
        exchangeId: 1,
        issuer: 1,
        type: 1,
        offerId: 1,
        credentialSubject: 1,
        credentialSchema: 1,
        credentialStatus: 1,
        contentHash: 1,
        linkCodeCommitment: 1,
        linkedCredentials: 1,
        replaces: 1,
        relatedResource: 1,
        digestSRI: 1,
        name: 1,
        description: 1,
        image: 1,
        awardedDate: 1,
        endorsement: 1,
        endorsementJwt: 1,
        evidence: 1,
        refreshService: 1,
        termsOfUrl: 1,
        notifiedOfRevocationAt: 1,
        validFrom: 1,
        validUntil: 1,
        issuanceDate: 1,
        expirationDate: 1,
        createdAt: 1,
        updatedAt: 1,
        rejectedAt: 1,
        consentedAt: 1,
      },
      extensions: [
        autoboxIdsExtension,
        multitenantExtension({
          migrateFrom: { repoProp: 'issuer.id', tenantProp: 'did' },
        }),
        (parent) => ({
          findUnexpiredOffersById: async (offerIds) =>
            parent.find({
              filter: {
                _id: {
                  $in: offerIds,
                },
              },
              orderBy: [{ createdAt: 1 }],
            }),
          findUniquePreparedOffers: async (
            { vendorUserId, types, offerHashes, exchangeId = null },
            { log },
          ) => {
            let mongoFilter = {
              'credentialSubject.vendorUserId': vendorUserId,
              consentedAt: { $exists: false },
              rejectedAt: { $exists: false },
            };
            if (size(types)) {
              mongoFilter.type = { $in: types };
            }
            if (size(offerHashes)) {
              mongoFilter['contentHash.value'] = { $nin: offerHashes };
            }
            if (exchangeId != null) {
              mongoFilter.exchangeId = exchangeId;
            }
            mongoFilter = parent.prepFilter(mongoFilter);
            log.info({ message: 'findUniquePreparedOffers', mongoFilter });
            const offers = await parent.find({ filter: mongoFilter });
            // FYI don't run validation on the offer
            return filterDuplicates(offers);
          },
          approveOffer: async (
            id,
            vendorUserId,
            credential,
            consentedAt,
            digestSRI,
            context,
          ) => {
            const { config } = context;
            const updates = {
              did: credential.id,
              consentedAt: consentedAt ?? new Date(),
              digestSRI,
              ...pick(
                [
                  'credentialStatus',
                  'credentialSchema',
                  'linkCodeCommitment',
                  'issued',
                  'issuanceDate',
                  'type',
                  '@context',
                ],
                credential,
              ),
            };
            if (config.autocleanFinalizedOfferPii) {
              updates.credentialSubject = { vendorUserId };
            } else {
              updates['credentialSubject.id'] = credential.credentialSubject.id;
            }
            return parent.update(id, updates, issuedCredentialProjection);
          },
          rejectOffers: async (vendorUserId, offerIds, context) => {
            const { config } = context;
            const updates = { rejectedAt: new Date() };
            if (config.autocleanFinalizedOfferPii) {
              updates.credentialSubject = { vendorUserId };
            }
            return parent.updateUsingFilter(
              {
                filter: {
                  _id: { $in: map((v) => new ObjectId(v), offerIds) },
                  rejectedAt: { $exists: false },
                },
              },
              updates,
            );
          },
        }),
        cleanPiiExtension,
      ],
    },
    app,
  );
};

const filterDuplicates = (offers) => {
  const hashes = new Set();
  const filtered = [];
  for (const offer of offers) {
    if (!hashes.has(offer.contentHash.value)) {
      filtered.push(offer);
      hashes.add(offer.contentHash.value);
    }
  }

  return filtered;
};
