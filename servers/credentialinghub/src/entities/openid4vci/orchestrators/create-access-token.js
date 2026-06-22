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
const { filter, flow, isEmpty, map } = require('lodash/fp');
const { calcSha384 } = require('@verii/crypto');
const { toCredentialConfigurationId } = require('../domain');

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

  const [credentials, issuerService] = await Promise.all([
    context.repos.credentials.findByDepotId({
      depotId: depot._id,
      claimable: true,
    }),
    context.repos.issuerServices.findById(depot.serviceId),
  ]);

  const accessTokenResponse = await openid4VciIssuer.generateAccessToken(
    accessTokenParameters,
    buildAuthorizationDetails(
      credentials,
      accessTokenParameters.authorization_details,
    ),
    issuerService.authTokensExpireIn,
  );
  return accessTokenResponse;
};

const buildAuthorizationDetails = (
  credentials,
  requestedAuthorizationDetails,
) => {
  const pipeline = [
    map((credential) => ({
      type: 'openid_credential',
      credential_configuration_id: toCredentialConfigurationId(
        credential.typeMetadata.credentialType,
      ),
      credential_identifiers: [`${credential._id}`],
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

  return flow(pipeline)(credentials);
};

module.exports = { createAccessToken };
