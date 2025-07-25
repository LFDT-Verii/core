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
  ...require('./allocations'),
  ...require('./common'),
  ...require('./credentials'),
  ...require('./deep-links'),
  ...require('./disclosures'),
  ...require('./exchanges'),
  ...require('./feeds'),
  ...require('./keys'),
  ...require('./notifications'),
  ...require('./offers'),
  ...require('./presentations'),
  ...require('./groups'),
  ...require('./schemas'),
  ...require('./tenants'),
  ...require('./tokens'),
  ...require('./users'),
  ...require('./redirect'),
  ...require('./push-delegate'),
};
