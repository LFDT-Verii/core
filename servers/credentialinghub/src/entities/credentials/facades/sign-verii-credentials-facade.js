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
  signVeriiCredentials,
} = require('@verii/verii-issuing');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { keyBy } = require('lodash/fp');
const { buildVeriiIssuer } = require('./build-verii-issuer');

const signVeriiCredentialsFacade = async (
  credentialContentList,
  credentialSubjectId,
  credentialTypeMetadatas,
  issuerService,
  context,
) => {
  const { tenant } = context;

  // eslint-disable-next-line better-mutation/no-mutation
  context.allocationListQueries = mongoAllocationListQueries(
    mongoDb(),
    'allocations',
  );
  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = context.tenant.caoDid;

  const result = await signVeriiCredentials(
    credentialContentList,
    credentialSubjectId,
    keyBy('credentialType', credentialTypeMetadatas),
    buildVeriiIssuer(tenant, issuerService),
    context,
  );
  return {
    credentialMetadata: result?.[0]?.metadata,
    vcJwt: result?.[0]?.vcJwt,
  };
};

module.exports = { signVeriiCredentialsFacade };
