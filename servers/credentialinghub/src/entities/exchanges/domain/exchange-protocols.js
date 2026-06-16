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

const ExchangeProtocols = {
  // The VCALM protocol (experimental implementation): https://w3c-ccg.github.io/vc-api/
  W3C_VCALM: 'vcalm',
  // The Velocity Network protocols. Issuing: https://hackmd.io/GdvzWGFBT16HcfijoowqUw & Inspection: https://hackmd.io/lk40OgPuSeCLbx2MegbVfA
  VN_API: 'vn_api',
  // The openid 4 vci protocol
  OPENID4VCI: 'openid4vci',
  // The openid 4 vp protocol
  OPENID4VP: 'openid4vp',
};

module.exports = { ExchangeProtocols };
