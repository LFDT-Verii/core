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

const newError = require('http-errors');
const { isString, isEmpty } = require('lodash/fp');
const { buildFailedCheckResultError } = require('@verii/verii-verification');
const { ExchangeStates } = require('../../exchanges');
const { identifyUserOnVendor } = require('../../../fetchers');
const { VendorEndpoint } = require('../../disclosures');
const {
  buildIdentityDoc,
  buildVendorData,
  mergeCredentialCheckResults,
} = require('../domains');
const { matchIdentityOnExchange } = require('./match-identity-on-exchange');

const shareIdentificationCredentials = async (
  disclosure,
  vendorOriginContext,
  checkedCredentials,
  context
) => {
  if (context.config.autoIdentityCheck) {
    throwOnFailedCheckResultError(checkedCredentials, context);
  }

  const identityDoc = buildIdentityDoc(checkedCredentials, context);
  const vendorUser =
    disclosure.vendorEndpoint === VendorEndpoint.ISSUING_IDENTIFICATION
      ? await sendIdentification(
          identityDoc,
          buildVendorData(disclosure, vendorOriginContext, context),
          context
        )
      : await matchIdentityOnExchange(identityDoc, disclosure, context);

  return {
    checkedCredentials: mergeCredentialCheckResults(checkedCredentials),
    vendorUser,
  };
};

const sendIdentification = async (identityDoc, vendorData, context) => {
  const { tenant, exchange } = context;
  const payload = {
    ...identityDoc,
    vendorOrganizationId: tenant.vendorOrganizationId,
    tenantDID: tenant.did,
    tenantId: tenant._id,
    exchangeId: exchange._id,
  };
  if (vendorData.vendorOriginContext != null) {
    payload.vendorOriginContext = vendorData.vendorOriginContext;
  }

  let vendorUser;
  try {
    vendorUser = await identifyUserOnVendor(payload, context);
  } catch (error) {
    if (error.statusCode === 404) {
      throw newError(401, 'user not found', {
        exchangeErrorState: ExchangeStates.NOT_IDENTIFIED,
        errorCode: 'upstream_user_not_found',
      });
    }
    throw error;
  }

  if (isEmpty(vendorUser?.vendorUserId) || !isString(vendorUser.vendorUserId)) {
    throw newError(
      401,
      'user not found - vendorUserId property should be a string value',
      {
        exchangeErrorState: ExchangeStates.NOT_IDENTIFIED,
        errorCode: 'upstream_userid_not_string',
      }
    );
  }

  return vendorUser;
};

const throwOnFailedCheckResultError = (checkedCredentials, context) => {
  for (const checkedCredential of checkedCredentials) {
    const error = buildFailedCheckResultError(checkedCredential, context);
    if (error != null) {
      throw error;
    }
  }
};

module.exports = {
  shareIdentificationCredentials,
};
