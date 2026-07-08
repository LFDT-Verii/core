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

const crypto = require('node:crypto');

const DEFAULT_SIGNATURE_HEADER_NAME = 'Verii-Signature';

const buildWebhookSignatureHeaders = ({
  event,
  rawBody,
  secret,
  signatureHeaderName = DEFAULT_SIGNATURE_HEADER_NAME,
  timestamp = Math.floor(Date.now() / 1000),
}) => {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'Verii-Event-Id': event.id,
    'Verii-Event-Type': event.type,
    'Verii-Event-Time': event.occurredAt,
    [signatureHeaderName]: `t=${timestamp},v1=${signature}`,
  };
};

module.exports = {
  DEFAULT_SIGNATURE_HEADER_NAME,
  buildWebhookSignatureHeaders,
};
