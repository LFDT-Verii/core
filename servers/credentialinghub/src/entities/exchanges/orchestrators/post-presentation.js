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
  verifyVerifiablePresentationJwt,
} = require('@verii/verii-verification');
const { ExchangeStates, validateReferencedService } = require('../domain');
const {
  PresentationFormat,
  validatePresentation,
} = require('../../presentations');
const {
  buildPresentationReceivedEvent,
  enqueueNotificationEvents,
} = require('../../notifications');

const postPresentation = async (
  exchangeId,
  jwtPresentationSubmission,
  context,
) => {
  const { repos } = context;

  const vp = await verifyVerifiablePresentationJwt(jwtPresentationSubmission, {
    vnfProtocolVersion: 2,
  });

  const exchange = await repos.exchanges.addState(
    exchangeId,
    ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
    {
      disclosureConsentedAt: new Date(),
    },
  );
  const relyingPartyService = await repos.relyingPartyServices.findOne({
    filter: { _id: exchange.serviceId },
  });
  validateReferencedService(relyingPartyService);
  validatePresentation(vp, exchange, context, vp.presentation_submission);
  const presentation = await repos.presentations.insert({
    depotId: exchange.depotId,
    exchangeId,
    format: PresentationFormat.JWT_VP,
    presentation: jwtPresentationSubmission,
  });
  await enqueueNotificationEvents(
    () =>
      buildPresentationReceivedEvent({
        tenant: context.tenant,
        exchange,
        presentation,
      }),
    context,
  );
  return [relyingPartyService, exchange, presentation];
};

module.exports = { postPresentation };
