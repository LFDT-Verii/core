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
const { map } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const {
  validateNewExchange,
  buildCredentialManifest,
  ExchangeTypes,
  ExchangeProtocols,
  ExchangeStates,
} = require('../domain');
const { fetchCredentialTypeDescriptors } = require('../../credential-types');

const getCredentialManifest = async (
  serviceId,
  credentialTypes,
  locale,
  messagingSettings,
  context,
) => {
  const { repos, tenant } = context;

  // setup exchange
  const newExchange = {
    type: ExchangeTypes.ISSUER,
    serviceId: new ObjectId(serviceId),
    protocolMetadata: {
      protocol: ExchangeProtocols.VN_API,
    },
    credentialTypes,
    messagingSettings,
  };

  // load issuer service
  const issuerService = await repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });

  validateNewExchange(newExchange, issuerService);

  const exchange = await repos.exchanges.insertWithInitialState(newExchange, [
    ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
  ]);
  // eslint-disable-next-line better-mutation/no-mutation
  context.exchange = exchange; // added onto the request for the exchange error handler

  const inputDescriptors = await fetchCredentialTypeDescriptors(
    map('type', issuerService?.disclosureRequest?.types),
    false,
    undefined,
    context,
  );

  const outputDescriptors = await fetchCredentialTypeDescriptors(
    credentialTypes,
    true,
    locale,
    context,
  );

  return buildCredentialManifest(
    tenant,
    issuerService,
    exchange,
    inputDescriptors,
    outputDescriptors,
  );
};

module.exports = { getCredentialManifest };
