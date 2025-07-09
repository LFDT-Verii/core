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
  ...require('./errors'),
  ...require('./constants'),
  ...require('./validate-by-identification-method'),
  ...require('./get-disclosure-configuration-type'),
  ...require('./is-issuing-disclosure'),
  ...require('./validate-disclosure-default-issuing'),
  ...require('./compute-disclosure-configuration-type'),
  ...require('./assert-disclosure-active'),
  ...require('./validate-disclosure-by-configuration-type'),
  ...require('./parse-body-to-disclosure'),
  ...require('./validate-vendor-endpoint'),
  ...require('./validate-disclosure'),
  ...require('./validate-vendor-webhook'),
  ...require('./validate-commercial-entity'),
};
