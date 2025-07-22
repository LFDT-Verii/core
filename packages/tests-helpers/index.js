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

const abi = require('./src/abi.json');

module.exports = {
  abi,
  ...require('./src/error-matchers'),
  ...require('./src/load-test-env'),
  ...require('./src/build-mongo-connection'),
  ...require('./src/test-auth-token'),
  ...require('./src/jsonify'),
  ...require('./src/mongoify'),
  ...require('./src/generate-key-pair-in-hex-and-jwk'),
  ...require('./src/jwk-matchers'),
  ...require('./src/generate-organization-key-matcher'),
  ...require('./src/test-oauth-user'),
  ...require('./src/s3-utils'),
  ...require('./src/spence-mongo-repos'),
};
