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
const { map, uniqBy } = require('lodash/fp');
const newError = require('http-errors');
const {
  ExchangeStates,
  authorizeExchange,
  generateIssuingChallenge,
} = require('../domain');
const { parseAccessToken } = require('../../tokens');

// eslint-disable-next-line default-param-last
const credentialOfferRequest = async (token, offerHashes = [], context) => {
  const { log, repos } = context;
  const { exchangeId, depotId } = parseAccessToken(token);
  const exchange = await repos.exchanges
    .addState(exchangeId, ExchangeStates.OFFERS_REQUESTED)
    .catch((error) => {
      log.error(error);
      throw newError(401, 'Unauthorized');
    });
  authorizeExchange(exchange, depotId);

  const credentials = await repos.credentials.findByDepotId({
    depotId,
    credentialTypes: exchange.credentialTypes,
    omitContentHashes: offerHashes,
    claimable: true,
  });

  const { challenge } = await generateIssuingChallenge(exchangeId, context);

  await repos.exchanges.addState(exchangeId, ExchangeStates.OFFERS_SENT, {
    credentialIds: map('_id', credentials),
  });

  return {
    challenge,
    offers: map(
      (credential) => buildOffer(credential, context),
      uniqBy('contentHash', credentials),
    ),
  };
};

const buildOffer = (credential, { tenant }) => ({
  ...credential.content,
  id: credential._id,
  hash: credential.contentHash,
  issuer: {
    ...(credential.content?.issuer ?? {}),
    id: tenant.did,
  },
});

module.exports = { credentialOfferRequest };
