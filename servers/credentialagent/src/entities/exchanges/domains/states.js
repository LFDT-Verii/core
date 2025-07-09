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

const ExchangeStates = {
  NEW: 'NEW',
  CREDENTIAL_MANIFEST_REQUESTED: 'CREDENTIAL_MANIFEST_REQUESTED',
  OFFERS_REQUESTED: 'OFFERS_REQUESTED',
  OFFERS_SENT: 'OFFERS_SENT',
  OFFERS_WAITING_ON_VENDOR: 'OFFERS_WAITING_ON_VENDOR',
  OFFERS_RECEIVED: 'OFFERS_RECEIVED',
  NO_OFFERS_RECEIVED: 'NO_OFFERS_RECEIVED',
  OFFER_VALIDATION_ERROR: 'OFFER_VALIDATION_ERROR',
  DISCLOSURE_RECEIVED: 'DISCLOSURE_RECEIVED',
  DISCLOSURE_CHECKED: 'DISCLOSURE_CHECKED',
  DISCLOSURE_UNCHECKED: 'DISCLOSURE_UNCHECKED',
  DISCLOSURE_REJECTED: 'DISCLOSURE_REJECTED',
  COMPLETE: 'COMPLETE',
  IDENTIFIED: 'IDENTIFIED',
  NOT_IDENTIFIED: 'NOT_IDENTIFIED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  CLAIMING_IN_PROGRESS: 'CLAIMING_IN_PROGRESS',
  OFFER_ID_UNDEFINED_ERROR: 'OFFER_ID_UNDEFINED_ERROR',
};

const ExchangeErrorCodeState = {
  EXCHANGE_INVALID: 'exchange_invalid',
  OFFERS_CLIAMED_SYNCH: 'offers_already_cliamed_synch',
};

module.exports = { ExchangeStates, ExchangeErrorCodeState };
