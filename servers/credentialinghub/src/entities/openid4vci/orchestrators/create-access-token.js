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
const {
  difference,
  filter,
  flatMap,
  flow,
  isEmpty,
  map,
} = require('lodash/fp');
const { calcSha384 } = require('@verii/crypto');
const {
  DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX,
  toCredentialConfigurationId,
} = require('../domain');

const createAccessToken = async (accessTokenParameters, context) => {
  const openid4VciIssuer = await context.getOpenId4VciIssuer();
  await openid4VciIssuer.validateAccessTokenParams(
    accessTokenParameters,
    context,
  );
  const depot = await context.repos.depots.findDepotByPreauthCode(
    accessTokenParameters['pre-authorized_code'],
  );
  await openid4VciIssuer.verifyPreauthCode(
    calcSha384(accessTokenParameters['pre-authorized_code']),
    depot?.preauthCodeHash,
    accessTokenParameters,
    context,
  );

  const [credentialIdentifiers, issuerService] = await Promise.all([
    loadCredentialIdentifiers(depot, context),
    context.repos.issuerServices.findById(depot.serviceId),
  ]);

  const accessTokenResponse = await openid4VciIssuer.generateAccessToken(
    accessTokenParameters,
    buildAuthorizationDetails(
      credentialIdentifiers,
      accessTokenParameters.authorization_details,
    ),
    issuerService.authTokensExpireIn,
    depot._id,
  );
  return accessTokenResponse;
};

// The claimable credentials' identifiers. A depot with deferred credentials also lists a deferred identifier
// for each expected type that has nothing to claim.
const loadCredentialIdentifiers = async (depot, { repos }) => {
  const credentials = await repos.credentials.findByDepotId({
    depotId: depot._id,
    claimable: true,
  });
  // The types a deferred transaction's claim matches
  const claimableTypes = flatMap('content.type', credentials);
  const deferredTypes =
    depot.deferredCredentials === true
      ? difference(depot.expectedCredentialTypes, claimableTypes)
      : [];
  return [
    ...map(
      (credential) => ({
        credentialType: credential.typeMetadata.credentialType,
        credentialIdentifier: `${credential._id}`,
      }),
      credentials,
    ),
    ...map(
      (credentialType) => ({
        credentialType,
        credentialIdentifier: `${DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX}${credentialType}`,
      }),
      deferredTypes,
    ),
  ];
};

const buildAuthorizationDetails = (
  credentialIdentifiers,
  requestedAuthorizationDetails,
) => {
  const pipeline = [
    map(({ credentialType, credentialIdentifier }) => ({
      type: 'openid_credential',
      credential_configuration_id: toCredentialConfigurationId(credentialType),
      credential_identifiers: [credentialIdentifier],
    })),
  ];

  if (!isEmpty(requestedAuthorizationDetails)) {
    const requestedCredentialConfigurationIds = map(
      'credential_configuration_id',
      requestedAuthorizationDetails,
    );
    pipeline.push(
      filter(({ credential_configuration_id: credentialConfigurationId }) =>
        requestedCredentialConfigurationIds.includes(credentialConfigurationId),
      ),
    );
  }

  return flow(pipeline)(credentialIdentifiers);
};

module.exports = { createAccessToken };
