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

const { isNil, map, reject, range } = require('lodash/fp');
const { nanoid } = require('nanoid');
const {
  verifyCredentials,
} = require('@verii/verifiable-credentials');
const { decodeCredentialJwt } = require('@verii/jwt');
const {
  getOrganizationVerifiedProfile,
  getCredentialTypeMetadata,
  resolveDid,
} = require('@verii/common-fetchers');
const { KeyPurposes } = require('@verii/crypto');
const { sendCredentials, sendPush } = require('../../../fetchers');
const { ExchangeStates } = require('../../exchanges');
const { NotificationTypes } = require('../../notifications');
const { isIssuingDisclosure, VendorEndpoint } = require('../../disclosures');
const {
  buildVendorData,
  checkPaymentRequirement,
  mergeCredentialCheckResults,
  validatePresentation,
} = require('../domains');
const {
  shareIdentificationCredentials,
} = require('./share-identification-credentials');
const {
  deduplicateDisclosureExchange,
} = require('./deduplicate-disclosure-exchange');

const sharePresentation = async (presentation, context) => {
  const { repos, exchange } = context;

  const disclosure = await repos.disclosures.findById(exchange.disclosureId, {
    _id: 1,
    vendorOrganizationId: 1,
    vendorDisclosureId: 1,
    vendorEndpoint: 1,
    identificationMethods: 1,
    identityMatchers: 1,
    sendPushOnVerification: 1,
    authTokensExpireIn: 1,
  });

  const {
    verifiableCredential,
    vendorOriginContext,
    id: presentationId,
    presentationIssuer,
  } = await validatePresentation(presentation, disclosure, context);

  await deduplicateDisclosureExchange(presentation, context);

  const { checkedCredentials, vendorUser } = await doSharePresentation(
    {
      disclosure,
      verifiableCredential,
      vendorOriginContext,
      presentationId,
      presentationIssuer,
    },
    context
  );

  const user = vendorUser
    ? await repos.vendorUserIdMappings.findOrInsertVendorUser(vendorUser)
    : await repos.vendorUserIdMappings.addAnonymousUser();

  const completionState = isIssuingDisclosure(disclosure)
    ? ExchangeStates.IDENTIFIED
    : ExchangeStates.COMPLETE;

  const completedExchange = await repos.exchanges.addState(
    exchange._id,
    completionState
  );

  return {
    checkedCredentials,
    exchange: completedExchange,
    user,
    disclosure,
  };
};

const doSharePresentation = async (
  {
    verifiableCredential,
    vendorOriginContext,
    presentationId,
    presentationIssuer,
    disclosure,
  },
  context
) => {
  const { exchange, tenant, repos } = context;
  const { vendorEndpoint } = disclosure;

  const vcJwts = reject(isNil, verifiableCredential);
  const uncheckedCredentials = map(canonicalizeCredential(context), vcJwts);
  const rawCredentials = buildRawCredentials(uncheckedCredentials, vcJwts);

  if (vendorEndpoint === VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS) {
    await repos.exchanges.addState(
      exchange._id,
      ExchangeStates.DISCLOSURE_UNCHECKED
    );
    await sendCredentials(
      disclosure.vendorEndpoint,
      {
        ...buildVendorData(disclosure, vendorOriginContext, context),
        presentationId,
        credentials: uncheckedCredentials,
        rawCredentials,
      },
      context
    );

    return { checkedCredentials: [] };
  }

  const checkedCredentials = await verifyCredentials(
    {
      credentials: vcJwts,
      expectedHolderDid: presentationIssuer,
      relyingParty: {
        dltOperatorKMSKeyId:
          context.tenantKeysByPurpose[KeyPurposes.DLT_TRANSACTIONS].keyId,
      },
    },
    {
      getOrganizationVerifiedProfile,
      getCredentialTypeMetadata,
      resolveDid,
    },
    context
  );

  await repos.exchanges.addState(
    exchange._id,
    ExchangeStates.DISCLOSURE_CHECKED
  );

  if (isIssuingDisclosure(disclosure)) {
    return shareIdentificationCredentials(
      disclosure,
      vendorOriginContext,
      checkedCredentials,
      context
    );
  }

  const mergedCredentials = mergeCredentialCheckResults(checkedCredentials);
  await sendCredentials(
    vendorEndpoint,
    {
      ...buildVendorData(disclosure, vendorOriginContext, context),
      presentationId,
      credentials: mergedCredentials,
      rawCredentials,
      paymentRequired: checkPaymentRequirement(checkedCredentials),
    },
    context
  );

  await sendPushVerification({ tenant, disclosure, exchange }, context);
  return { checkedCredentials: mergedCredentials };
};

const buildRawCredentials = (uncheckedCredentials, vcJwts) => {
  const credentialSchemaUris = map('id', uncheckedCredentials);
  return map(
    (i) => ({ id: credentialSchemaUris[i], rawCredential: vcJwts[i] }),
    range(0, vcJwts.length)
  );
};

const sendPushVerification = async (
  { disclosure, exchange, tenant },
  context
) => {
  const { pushDelegate } = exchange;
  if (
    !disclosure.sendPushOnVerification ||
    !pushDelegate ||
    !pushDelegate.pushUrl ||
    !pushDelegate.pushToken
  ) {
    return;
  }

  await sendPush(
    {
      id: nanoid(),
      pushToken: pushDelegate.pushToken,
      data: {
        notificationType: NotificationTypes.PRESENTATION_VERIFIFED,
        issuer: tenant.did,
        exchangeId: exchange._id,
        serviceEndpoint: pushDelegate.pushUrl,
      },
    },
    pushDelegate,
    context
  );
};

const canonicalizeCredential =
  ({ config }) =>
  (vcJwt) => {
    const decodedCredential = decodeCredentialJwt(vcJwt);
    if (config.vendorCredentialsIncludeIssuedClaim) {
      // eslint-disable-next-line better-mutation/no-mutation
      decodedCredential.issued = decodedCredential.issuanceDate;
    }

    return decodedCredential;
  };

module.exports = { sharePresentation };
