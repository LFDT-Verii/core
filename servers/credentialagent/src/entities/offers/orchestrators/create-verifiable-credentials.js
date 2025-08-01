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

const { toEthereumAddress } = require('@verii/blockchain-functions');
const { mapWithIndex } = require('@verii/common-functions');
const { KeyPurposes, calcSha384 } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');
const { hexFromJwk, jwtDecode } = require('@verii/jwt');
const {
  prepareVelocityVerifiableCredentials,
  anchorVelocityVerifiableCredentials,
  mongoAllocationListQueries,
} = require('@verii/velocity-issuing');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { first, isEmpty, map, size } = require('lodash/fp');
const newError = require('http-errors');
const { loadCredentialTypesMap } = require('./load-credential-types-map');
const {
  triggerIssuedCredentialsWebhook,
} = require('./trigger-issued-credentials-webhook');
const { ExchangeStates } = require('../../exchanges');
const {
  prepareLinkedCredentialsForHolder,
} = require('../domains/prepare-linked-credentials-for-holder');

const createVerifiableCredentials = async (
  offers,
  credentialSubjectId,
  consentedAt,
  context
) => {
  const { exchange, repos, config } = context;

  const issuableOffers = map((offer) => {
    const linkedCredentials = prepareLinkedCredentialsForHolder(
      offer.linkedCredentials
    );
    return isEmpty(linkedCredentials) ? offer : { ...offer, linkedCredentials };
  }, offers);

  const jwtVcs = await doIssueVerifiableCredentials(
    issuableOffers,
    credentialSubjectId,
    context
  );

  const updatedOffers = await Promise.all(
    mapWithIndex(async (offer, i) => {
      const digestSRI = `sha384-${calcSha384(jwtVcs[i])}`;
      return repos.offers.approveOffer(
        offer._id,
        exchange.vendorUserId,
        jwtDecode(jwtVcs[i]).payload.vc,
        consentedAt,
        digestSRI,
        context
      );
    }, issuableOffers)
  );

  if (config.triggerOffersAcceptedWebhook && size(updatedOffers) > 0) {
    await triggerIssuedCredentialsWebhook(updatedOffers, context);
  }

  return jwtVcs;
};

const doIssueVerifiableCredentials = async (
  offers,
  credentialSubjectId,
  context
) => {
  const { tenant, tenantKeysByPurpose } = context;

  const issuerServiceKey = tenantKeysByPurpose[KeyPurposes.ISSUING_METADATA];
  const dltOperatorKey = tenantKeysByPurpose[KeyPurposes.DLT_TRANSACTIONS];

  // Load credential types
  const credentialTypesMap = await loadCredentialTypesMap(offers, context);

  // eslint-disable-next-line better-mutation/no-mutation
  context.allocationListQueries = mongoAllocationListQueries(
    mongoDb(),
    'allocations'
  );

  const issuer = {
    id: tenant._id,
    did: tenant.did,
    issuingServiceId: first(tenant.serviceIds),
    issuingServiceKMSKeyId: issuerServiceKey.keyId,
    issuingServiceDIDKeyId: toDidUrl(tenant.did, issuerServiceKey.kidFragment),
    dltOperatorAddress:
      dltOperatorKey.publicKey != null
        ? toEthereumAddress(hexFromJwk(dltOperatorKey.publicKey, false))
        : null,
    dltOperatorKMSKeyId: dltOperatorKey.keyId,
    dltPrimaryAddress: tenant.primaryAddress,
  };

  try {
    const { vcs, revocationListEntries } =
      await prepareVelocityVerifiableCredentials(
        offers,
        credentialSubjectId,
        credentialTypesMap,
        issuer,
        context
      );

    return await anchorVelocityVerifiableCredentials(
      vcs,
      revocationListEntries,
      issuer,
      context
    );
  } catch (e) {
    switch (e.errorCode) {
      case 'career_issuing_not_permitted':
      case 'identity_issuing_not_permitted':
      case 'contact_issuing_not_permitted':
        throw newError(502, e, {
          exchangeErrorState: ExchangeStates.UNEXPECTED_ERROR,
        });
      default:
        throw e;
    }
  }
};

module.exports = { createVerifiableCredentials };
