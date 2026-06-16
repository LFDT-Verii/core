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

const { applyOverrides } = require('@verii/common-functions');
const { find, map, omit } = require('lodash/fp');

const DEFAULT_GROUP_ID = 'A';

const buildCredentialManifest = (
  tenant,
  issuerService,
  exchange,
  inputDescriptors,
  outputDescriptors,
) => {
  const baseUrl = buildBaseUrl(tenant);
  const overrides = {
    output_descriptors: outputDescriptors,
    issuer: { id: tenant.did },
    'metadata.submit_presentation_uri': `${baseUrl}/authenticate`,
    'metadata.check_offers_uri': `${baseUrl}/credential-offers`,
    'metadata.finalize_offers_uri': `${baseUrl}/issue-credentials`,
  };

  return buildBasePresentationRequest(
    tenant,
    issuerService,
    exchange,
    inputDescriptors,
    {
      rule: 'all',
      from: DEFAULT_GROUP_ID,
      min: issuerService.disclosureRequest?.types?.length,
    },
    overrides,
  );
};

const buildPresentationRequest = (
  tenant,
  service,
  exchange,
  inputDescriptors,
) => {
  const baseUrl = buildBaseUrl(tenant);
  return buildBasePresentationRequest(
    tenant,
    service,
    exchange,
    inputDescriptors,
    {
      rule: 'pick',
      from: DEFAULT_GROUP_ID,
      min: 1,
    },
    {
      'metadata.submit_presentation_uri': `${baseUrl}/presentation`,
      'metadata.auth_token_uri': `${baseUrl}/oauth/token`,
    },
  );
};

const buildBasePresentationRequest = (
  tenant,
  service,
  exchange,
  inputDescriptors,
  submissionRequirements,
  overrides,
) => {
  const presentationRequest = {
    exchange_id: exchange._id,
    metadata: buildMetadata(tenant, service),
    presentation_definition: buildPresentationDefinition(
      service,
      exchange,
      inputDescriptors,
      submissionRequirements,
    ),
  };

  return applyOverrides(presentationRequest, overrides);
};

const buildPresentationDefinition = (
  service,
  exchange,
  rawInputDescriptors,
  submissionRequirements,
) => {
  const id = `${exchange._id}.${service._id}`;
  const format = {
    jwt_vp: { alg: ['secp256k1'] }, // hardcoded
  };

  if (service.presentationDefinition) {
    return buildConfiguredPresentationDefinition(service, id, format);
  }

  const inputDescriptors = buildInputDescriptors(
    service.disclosureRequest?.types,
    rawInputDescriptors,
  );

  return {
    id,
    purpose: service.disclosureRequest?.purpose ?? '',
    name: service.description,
    format,
    input_descriptors: inputDescriptors,
    submission_requirements: submissionRequirements.min
      ? [submissionRequirements]
      : [],
  };
};

const buildConfiguredPresentationDefinition = (service, id, format) => {
  const presentationDefinition = omit(['id'], service.presentationDefinition);
  return {
    purpose: service.presentationDefinition.purpose,
    name: service.description,
    format,
    ...presentationDefinition,
    // The presentation-definition id binds the eventual submission to this
    // exchange and service, so caller-provided presentationDefinition.id is
    // ignored.
    id,
  };
};

const buildBaseUrl = (tenant) =>
  `${tenant.hostUrl}/vn-api/r/${encodeURI(tenant.did)}`;

const buildMetadata = (tenant, service) => {
  const metadata = {
    client_name: tenant.name,
    logo_uri: tenant.logo,
    tos_uri: service.termsUrl,
    progress_uri: `${buildBaseUrl(tenant)}/get-exchange-progress`,
  };

  if (!service.authMode) {
    metadata.feed = service.mode === 'feed';
  }

  metadata.max_retention_period =
    service.disclosureRequest?.retentionPeriod ?? '';

  return metadata;
};

const buildInputDescriptors = (types, rawInputDescriptors) =>
  map(
    ({ type }) => ({
      ...find({ id: type }, rawInputDescriptors),
      group: [DEFAULT_GROUP_ID],
    }),
    types,
  );

module.exports = { buildPresentationRequest, buildCredentialManifest };
