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
  PRESENTATION_REQUEST_REQUESTED: 'PRESENTATION_REQUEST_REQUESTED',
  PRESENTATION_SUBMISSION_RECEIVED: 'PRESENTATION_SUBMISSION_RECEIVED',
  PRESENTATION_VERIFIED: 'PRESENTATION_VERIFIED',
  PRESENTATION_VERIFICATION_SKIPPED: 'PRESENTATION_VERIFICATION_SKIPPED',
  CREDENTIAL_MANIFEST_REQUESTED: 'CREDENTIAL_MANIFEST_REQUESTED',
  AUTHENTICATION_REQUEST: 'AUTHENTICATION_REQUEST',
  AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  OFFERS_REQUESTED: 'OFFERS_REQUESTED',
  OFFERS_SENT: 'OFFERS_SENT',
  CLAIMING_IN_PROGRESS: 'CLAIMING_IN_PROGRESS',
  CREDENTIALS_SIGNED: 'CREDENTIALS_SIGNED',
  CLIENT_ERROR: 'CLIENT_ERROR',
  COMPLETE: 'COMPLETE',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
};

module.exports = { ExchangeStates };
