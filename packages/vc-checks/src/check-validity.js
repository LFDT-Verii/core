/**
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
 */

const { CheckResults } = require('./check-results');

const checkValidity = (credential, now = Date.now()) => {
  const { validFrom, validUntil } = credential;

  if (isInvalidValidityInterval(validFrom, validUntil, now)) {
    return CheckResults.FAIL;
  }
  return validUntil == null && validFrom == null
    ? CheckResults.NOT_APPLICABLE
    : CheckResults.PASS;
};

const isAfter = (date, time) => date != null && Date.parse(date) > time;

const isBefore = (date, time) => date != null && Date.parse(date) < time;

const isInvalidCurrentTime = (validFrom, validUntil, now) =>
  (validFrom != null || validUntil != null) && !Number.isFinite(now);

const isInvalidValidityInterval = (validFrom, validUntil, now) =>
  isInvalidCurrentTime(validFrom, validUntil, now) ||
  !isParseable(validFrom) ||
  !isParseable(validUntil) ||
  isAfter(validFrom, now) ||
  isBefore(validUntil, now);

const isParseable = (date) => date == null || Number.isFinite(Date.parse(date));

module.exports = { checkValidity };
