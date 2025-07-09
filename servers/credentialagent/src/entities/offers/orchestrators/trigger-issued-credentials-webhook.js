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

const { map, pick, omit } = require('lodash/fp');
const { issuedCredentialsNotificationCallback } = require('../../../fetchers');

const triggerIssuedCredentialsWebhook = async (approvedOffers, context) => {
  const { exchange, log, tenant, sendError } = context;
  try {
    await issuedCredentialsNotificationCallback(
      {
        issuedCredentials: map(buildIssuedCredential(context), approvedOffers),
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      },
      context
    );
  } catch (err) {
    const message = 'callback call failed with an error';
    const messageContext = {
      offers: approvedOffers,
      exchangeId: exchange._id,
      err,
    };
    log.error(messageContext, message);
    sendError(err, { ...messageContext, message });
  }
};

const buildIssuedCredential =
  ({ config }) =>
  (credential) => {
    const issuedCredential = omit(['did', 'credentialSubject'], credential);
    // eslint-disable-next-line better-mutation/no-mutation
    issuedCredential.id = credential.did;
    // eslint-disable-next-line better-mutation/no-mutation
    issuedCredential.credentialSubject = pick(
      'vendorUserId',
      credential.credentialSubject
    );
    if (config.vendorCredentialsIncludeIssuedClaim) {
      // eslint-disable-next-line better-mutation/no-mutation
      issuedCredential.issued = issuedCredential.issuanceDate;
    }
    return issuedCredential;
  };

module.exports = { triggerIssuedCredentialsWebhook };
