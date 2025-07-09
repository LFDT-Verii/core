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
const buildVendorData = (
  disclosure,
  vendorOriginContext,
  { tenant, exchange }
) => ({
  tenantId: tenant._id,
  tenantDID: tenant.did,
  exchangeId: exchange._id.toString(),
  vendorOrganizationId: tenant.vendorOrganizationId,
  vendorDisclosureId: disclosure.vendorDisclosureId,
  vendorOriginContext,
  sendPushOnVerification: disclosure.sendPushOnVerification,
});

module.exports = { buildVendorData };
