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

const ExchangeTypes = {
  ISSUING: 'ISSUING',
  DISCLOSURE: 'DISCLOSURE',
};

const ExchangeProtocols = {
  // The VC-API protocol (experimental implementation): https://w3c-ccg.github.io/vc-api/
  W3C_VC_API: 'vc-api',
  // The Velocity Network protocols. Issuing: https://hackmd.io/GdvzWGFBT16HcfijoowqUw & Inspection: https://hackmd.io/lk40OgPuSeCLbx2MegbVfA
  VNF_API: 'velocity_api',
  // The OIDC SIOP v1 protocol (deprecated implementation): https://openid.net/specs/openid-connect-self-issued-v2-1_0.html
  OIDC_SIOP: 'oidc_siop',
};

module.exports = { ExchangeTypes, ExchangeProtocols };
