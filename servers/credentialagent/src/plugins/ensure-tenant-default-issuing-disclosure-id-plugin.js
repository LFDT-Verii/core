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

const fp = require('fastify-plugin');
const { isEmpty, isNull, isObject } = require('lodash/fp');
const {
  VendorEndpointCategory,
  IdentificationMethods,
} = require('../entities');

const ensureTenantDefaultIssuingDisclosureIdPlugin = (
  fastify,
  options,
  next
) => {
  fastify.addHook('preValidation', async (req) => {
    const { tenant, repos } = req;
    if (
      isObject(tenant.defaultIssuingDisclosureId) ||
      isNull(tenant.defaultIssuingDisclosureId)
    ) {
      return;
    }
    const disclosures = await repos.disclosures.find({
      filter: {
        identificationMethods: {
          $ne: [IdentificationMethods.PREAUTH],
        },
        vendorEndpoint: {
          $in: VendorEndpointCategory.ISSUING,
        },
      },
      sort: { createdAt: -1 },
    });
    req.tenant = await req.repos.tenants.setDefaultIssuingDisclosure(
      tenant._id,
      isEmpty(disclosures) ? null : disclosures[0]._id
    );
  });
  next();
};

module.exports = {
  ensureTenantDefaultIssuingDisclosureIdPlugin: fp(
    ensureTenantDefaultIssuingDisclosureIdPlugin
  ),
};
