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
  ...require('./build-deep-link-url'),
  ...require('./build-redirect-url'),
  ...require('./build-vn-api-issuing-link'),
  ...require('./build-vn-api-presentation-link'),
  ...require('./build-openid4vci-credential-offer-link'),
  ...require('./build-openid4vp-authorization-request-link'),
  ...require('./is-preauth-code-auth'),
  ...require('./link-errors'),
  ...require('./validate-issue-link'),
  ...require('./validate-presentation-link'),
};
