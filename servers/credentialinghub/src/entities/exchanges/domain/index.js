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
module.exports = {
  ...require('./authorize-exchange'),
  ...require('./build-presentation-request'),
  ...require('./build-exchange-event'),
  ...require('./exchange-errors'),
  ...require('./exchange-protocols'),
  ...require('./exchange-states'),
  ...require('./exchange-types'),
  ...require('./generate-issuing-challenge'),
  ...require('./validate-message-settings'),
  ...require('./validate-new-exchange'),
  ...require('./validate-preauth'),
  ...require('./validate-referenced-service'),
  ...require('./verify-issuing-challenge'),
  ...require('./verify-proof-of-key-possession'),
};
