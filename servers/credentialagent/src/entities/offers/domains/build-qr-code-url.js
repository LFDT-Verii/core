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

const { appendSearchParam } = require('@verii/common-functions');

const getDisclosureQrCodeUri = (
  { did, disclosureId, vendorOriginContext },
  { config: { hostUrl } }
) =>
  appendSearchParam(
    'vendorOriginContext',
    vendorOriginContext
  )(
    new URL(
      `${hostUrl}/operator-api/v0.8/tenants/${did}/disclosures/${disclosureId}/qrcode.png`
    )
  ).toString();

const getExchnageQrCodeUri = ({ did, exchangeId }, { config: { hostUrl } }) =>
  new URL(
    `${hostUrl}/operator-api/v0.8/tenants/${did}/exchanges/${exchangeId}/qrcode.png`
  ).toString();

module.exports = { getDisclosureQrCodeUri, getExchnageQrCodeUri };
