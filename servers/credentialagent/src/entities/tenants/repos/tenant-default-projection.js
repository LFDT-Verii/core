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

const tenantDefaultProjection = {
  _id: 1,
  did: 1,
  dids: 1,
  serviceId: 1, // TODO remove serviceId after 31 March 2021
  serviceIds: 1,
  kid: 1,
  primaryAddress: 1,
  vendorOrganizationId: 1,
  createdAt: 1,
  updatedAt: 1,
  webhookUrl: 1,
  webhookAuth: 1,
  defaultIssuingDisclosureId: 1,
};

module.exports = { tenantDefaultProjection };
