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

module.exports = {
  ...require('./src/check-expiration'),
  ...require('./src/check-results'),
  ...require('./src/check-holder'),
  ...require('./src/check-identity-issuer'),
  ...require('./src/check-issuer-trust'),
  ...require('./src/verify-primary-source-issuer'),
  ...require('./src/check-credential-status'),
  ...require('./src/check-jwt-vc-tampering'),
  ...require('./src/verify-issuer-for-credential-type'),
  ...require('./src/vnf-protocol-versions'),
  ...require('./src/extract-credential-type'),
  ...require('./src/credential-status'),
  ...require('./src/velocity-revocation-list-type'),
};
