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
  mongoAllocationListQueries,
  signVersionedCredentials,
} = require('@verii/verii-issuing');
const { CredentialEnvelopeFormats } = require('@verii/jwt');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { keyBy } = require('lodash/fp');
const { buildVeriiIssuer } = require('./build-verii-issuer');

const signVeriiCredentialsFacade = async (
  credentialContentList,
  credentialSubjectId,
  credentialTypeMetadatas,
  credentialSigningAlgorithms,
  issuerService,
  context,
) => {
  const { credentialMetadata, issuanceResult } =
    await signVersionedCredentialsFacade({
      context,
      credentialContentList,
      credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
      credentialSigningAlgorithms,
      credentialSubjectId,
      credentialTypeMetadatas,
      issuerService,
    });
  return {
    credentialMetadata,
    vcJwt: issuanceResult?.compact,
  };
};

const signVersionedCredentialsFacade = async ({
  context,
  credentialContentList,
  credentialFormat,
  credentialSigningAlgorithms,
  credentialSubjectId,
  credentialTypeMetadatas,
  issuerService,
}) => {
  const { tenant } = context;

  // eslint-disable-next-line better-mutation/no-mutation
  context.allocationListQueries = mongoAllocationListQueries(
    mongoDb(),
    'allocations',
  );
  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = context.tenant.caoDid;

  const result = await signVersionedCredentials({
    context,
    credentialFormat,
    credentialSigningAlgorithms,
    credentialSubjectId,
    credentialTypesMap: keyBy('credentialType', credentialTypeMetadatas),
    issuer: buildVeriiIssuer(tenant, issuerService),
    offers: credentialContentList,
  });
  return {
    credentialMetadata: result?.[0]?.metadata,
    issuanceResult: result?.[0]?.issuanceResult,
  };
};

module.exports = {
  signVeriiCredentialsFacade,
  signVersionedCredentialsFacade,
};
