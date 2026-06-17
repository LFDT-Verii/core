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

const { calcSha384 } = require('@verii/crypto');
const { buildExchangeEvent } = require('../../exchanges/domain');

const updateExtensions = (parent, context) => ({
  updateIssuedCredential: async (
    credentialId,
    credentialDid,
    jwtVc,
    credentialSubjectId,
    isAccepted,
    exchange,
  ) => {
    const digestSRI = `sha384-${calcSha384(jwtVc)}`;
    const $set = {
      did: credentialDid,
      credentialSubjectId,
      digestSRI,
    };
    if (isAccepted) {
      $set.acceptedAt = new Date();
    }
    if (exchange) {
      $set.exchange = exchange;
    }
    if (context.config.autocleanFinalizedOfferPii) {
      $set.content = {};
    } else {
      $set.jwtVc = jwtVc;
    }

    return parent.update(credentialId, $set);
  },
  addExchangeState: async (credentialId, state, props) =>
    parent.collection().updateOne(
      { _id: credentialId },
      {
        $set: props,
        $push: { 'exchange.events': buildExchangeEvent(state) },
      },
    ),
});

module.exports = { updateExtensions };
