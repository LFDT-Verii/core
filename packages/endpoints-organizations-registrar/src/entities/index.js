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

module.exports = {
  ...require('./groups'),
  ...require('./invitations'),
  ...require('./images'),
  ...require('./oauth'),
  ...require('./organization-services'),
  ...require('./organizations'),
  ...require('./organization-keys'),
  ...require('./registrar-consents'),
  ...require('./monitors'),
  // TODO probably remove the below once broker is refactored vl-5139
  ...require('./signatories'),
  ...require('./users'),
};
