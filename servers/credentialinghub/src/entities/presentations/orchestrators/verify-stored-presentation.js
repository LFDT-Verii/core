/*
 * Copyright 2026 Velocity Team
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
const { sendWalletMessage } = require('../../wallet-messages');
const { verifyPresentation } = require('./verify-presentation');

const verifyStoredPresentation = async (
  { presentationId, notifyHolder },
  context,
) => {
  const presentation = await loadPresentation(presentationId, context);
  const result = await verifyPresentation(presentation.presentation, context);
  await context.repos.presentations.addVerification(
    presentation._id,
    result.verification,
  );
  if (!notifyHolder) {
    return result;
  }

  // Sent whatever the result: it tells the holder that the credentials were checked, not that they passed.
  return {
    ...result,
    notification: await sendPresentationVerified(presentation, context),
  };
};

const loadPresentation = async (presentationId, { repos }) => {
  const presentation = await repos.presentations.findOne({
    filter: { _id: presentationId },
  });
  if (presentation == null) {
    throw newError(404, `Presentation ${presentationId} not found`, {
      errorCode: 'presentation_not_found',
    });
  }
  return presentation;
};

const sendPresentationVerified = async (presentation, context) => {
  const exchange = await context.repos.exchanges.findOne(
    { filter: { _id: presentation.exchangeId } },
    { _id: 1, messagingSettings: 1 },
  );
  return sendWalletMessage(
    {
      exchange,
      data: {
        notificationType: 'PresentationVerified',
        issuer: context.tenant.did,
        serviceEndpoint: exchange?.messagingSettings?.webhookUrl,
      },
    },
    context,
  );
};

module.exports = { verifyStoredPresentation };
