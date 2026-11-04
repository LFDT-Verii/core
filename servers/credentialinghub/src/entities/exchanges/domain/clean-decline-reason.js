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
const { trim } = require('lodash/fp');

const MAX_DECLINE_REASON_LENGTH = 500;

// A blank reason counts as none. The VN API schema rejects longer reasons;
// an OpenID4VP error_description has no limit, so it is cut to the same length.
const cleanDeclineReason = (reason) => {
  const trimmedReason = trim(reason);

  return trimmedReason === ''
    ? undefined
    : trimmedReason.slice(0, MAX_DECLINE_REASON_LENGTH);
};

module.exports = { MAX_DECLINE_REASON_LENGTH, cleanDeclineReason };
