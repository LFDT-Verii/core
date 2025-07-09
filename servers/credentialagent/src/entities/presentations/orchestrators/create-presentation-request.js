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

const { map } = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const {
  getOrganizationVerifiedProfile,
  getCredentialTypeDescriptor,
} = require('@verii/common-fetchers');
const { ExchangeTypes } = require('../../exchanges/domains');

const GROUP_ID = 'A';

const createPresentationRequest = async (disclosure, exchange, context) => {
  const { tenant } = context;
  const orgProfile = await getOrgProfile(tenant.did, context);

  return {
    exchange_id: exchange._id,
    metadata: buildMetadata(disclosure, exchange, orgProfile, context),
    presentation_definition: await buildPresentationDefinition(
      disclosure,
      exchange,
      context
    ),
  };
};

const buildPresentationDefinition = async (disclosure, exchange, context) => {
  const id = `${exchange._id}.${disclosure._id}`;
  const format = {
    jwt_vp: { alg: ['secp256k1'] }, // hardcoded
  };

  if (disclosure.presentationDefinition) {
    const purpose =
      disclosure.presentationDefinition.purpose ?? disclosure.purpose;
    return {
      ...disclosure.presentationDefinition,
      purpose,
      format,
      id,
    };
  }
  const rawDescriptors = await Promise.all(
    map(
      ({ type }) =>
        getCredentialTypeDescriptor({ type, includeDisplay: false }, context),
      disclosure.types
    )
  );

  return {
    id,
    purpose: disclosure?.purpose,
    name: disclosure?.description,
    format,
    input_descriptors: buildInputDescriptors(disclosure.types, rawDescriptors),
    submission_requirements: buildSubmissionRequirements(
      exchange,
      rawDescriptors
    ),
  };
};

const getOrgProfile = async (tenantDid, context) => {
  const { credentialSubject: orgProfile } =
    await getOrganizationVerifiedProfile(tenantDid, context);

  return orgProfile;
};

const buildMetadata = (
  disclosure,
  exchange,
  orgProfile,
  { config: { hostUrl }, tenant }
) => {
  const baseUrl = `${hostUrl}/api/holder/v0.6/org/${encodeURI(tenant.did)}`;

  const clientName = disclosure.commercialEntityName ?? orgProfile?.name;
  const logoUri = disclosure.commercialEntityLogo ?? orgProfile?.logo;
  const metadata = {
    client_name: clientName,
    logo_uri: logoUri,
    tos_uri: disclosure?.termsUrl,
    max_retention_period: disclosure?.duration,
    progress_uri: `${baseUrl}/get-exchange-progress`,
    auth_token_uri: `${baseUrl}/oauth/token`,
    feed: disclosure?.feed,
  };

  if (exchange.type === ExchangeTypes.ISSUING) {
    metadata.submit_presentation_uri =
      exchange.protocolMetadata?.redirect_uri ??
      `${baseUrl}/issue/submit-identification`;
    metadata.check_offers_uri = `${baseUrl}/issue/credential-offers`;
    metadata.finalize_offers_uri = `${baseUrl}/issue/finalize-offers`;
  } else {
    metadata.submit_presentation_uri =
      exchange.protocolMetadata?.redirect_uri ??
      `${baseUrl}/inspect/submit-presentation`;
  }

  return metadata;
};

const buildSubmissionRequirements = ({ type }, rawDescriptors) => {
  if (type === ExchangeTypes.ISSUING) {
    return [
      {
        rule: 'all',
        from: GROUP_ID,
        min: rawDescriptors.length,
      },
    ];
  }

  return [
    {
      rule: 'pick',
      from: GROUP_ID,
      min: 1,
    },
  ];
};

const buildInputDescriptors = (types, rawDescriptors) =>
  mapWithIndex((type, idx) => ({
    ...rawDescriptors[idx],
    group: [GROUP_ID],
  }))(types);

module.exports = { createPresentationRequest };
