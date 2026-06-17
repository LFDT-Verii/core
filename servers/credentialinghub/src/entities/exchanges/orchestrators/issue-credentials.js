/*
 * Copyright 2024 Velocity Team
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
const { isEmpty, map, uniq } = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const { jwtDecode } = require('@verii/jwt');
const { parseAccessToken } = require('../../tokens');
const { ExchangeStates, verifyProofOfKeyPossession } = require('../domain');
const { authorizeExchange } = require('../domain/authorize-exchange');
const { issueVeriiCredentialsFacade } = require('../../credentials');

const issueCredentials = async (
  token,
  approvedCredentialIds,
  rejectedCredentialIds,
  keyPossessionProof,
  context,
) => {
  const { log, repos } = context;
  const { exchangeId, depotId } = parseAccessToken(token);
  const exchange = await repos.exchanges
    .addState(exchangeId, ExchangeStates.CLAIMING_IN_PROGRESS)
    .catch((error) => {
      log.error(error);
      throw newError(401, 'Unauthorized');
    });
  authorizeExchange(exchange, depotId);
  const issuerService = await repos.issuerServices.findById(exchange.serviceId);

  const rejectedCredentials = await rejectCredentials(
    rejectedCredentialIds,
    context,
  );

  const [issuedCredentials, jwtVcs] = await issueApprovedCredentials(
    approvedCredentialIds,
    keyPossessionProof,
    exchange,
    issuerService,
    context,
  );

  await repos.exchanges.addState(exchange._id, ExchangeStates.COMPLETE, {
    finalizedCredentialIds: uniq([
      ...(exchange.finalizedCredentialIds ?? []),
      ...map('_id', rejectedCredentials),
      ...map('_id', issuedCredentials),
    ]),
  });

  return jwtVcs;
};

const rejectCredentials = (credentialIds, { repos }) => {
  if (!isEmpty(credentialIds)) {
    return repos.credentials.updateUsingFilter(
      { filter: { _id: { $in: credentialIds } } },
      { rejectedAt: new Date() },
    );
  }

  return Promise.resolve([]);
};

const issueApprovedCredentials = async (
  credentialIds,
  proof,
  exchange,
  issuerService,
  context,
) => {
  const { repos, log } = context;

  if (isEmpty(credentialIds)) {
    return Promise.resolve([[], []]);
  }

  const approvedCredentials =
    await repos.credentials.findNonFinal(credentialIds);

  if (isEmpty(approvedCredentials)) {
    log.info('approved credentials not found');
    return [[], []];
  }

  const credentialSubjectId = await verifyProofOfKeyPossession(
    proof,
    exchange,
    context,
  );

  const jwtVcs = await issueVeriiCredentialsFacade(
    map('content', approvedCredentials),
    credentialSubjectId,
    map('typeMetadata', approvedCredentials),
    issuerService,
    context,
  );

  const issuedCredentials = await Promise.all(
    mapWithIndex(
      async (credential, i) =>
        repos.credentials.updateIssuedCredential(
          credential._id,
          jwtDecode(jwtVcs[i]).payload.vc.id,
          jwtVcs[i],
          credentialSubjectId,
          true,
        ),
      approvedCredentials,
    ),
  );

  return [issuedCredentials, jwtVcs];
};

module.exports = { issueCredentials };
