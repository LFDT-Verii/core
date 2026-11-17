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

// The preauthCodeExpiresIn of a depot whose pre-authorized codes never expire.
const PREAUTH_CODE_NEVER_EXPIRES = 'never';

// The longest a depot's pre-authorized codes can last, in seconds: 10 years.
// A depot whose codes should last longer never expires them instead.
const PREAUTH_CODE_EXPIRES_IN_MAX_SECONDS = 10 * 365 * 24 * 60 * 60;

module.exports = {
  PREAUTH_CODE_EXPIRES_IN_MAX_SECONDS,
  PREAUTH_CODE_NEVER_EXPIRES,
};
