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
const { includes } = require('lodash/fp');
const { isBefore } = require('date-fns/fp');

// A service that matches depots by the auth values its
// verifiablePresentationAuthRules read from the presented credentials.
const isInternalVpAuth = (service) =>
  service.authMode === 'internal' &&
  includes('verifiable_presentation', service.authMethods);

// date-fns/fp takes the date to compare with first, so this is
// deactivationDate < now: a service is deactivated once its deactivationDate
// has passed. deactivationDate is a Date or an ISO string.
const isServiceDeactivated = (service) =>
  service.deactivationDate != null &&
  isBefore(new Date(), service.deactivationDate);

module.exports = { isInternalVpAuth, isServiceDeactivated };
