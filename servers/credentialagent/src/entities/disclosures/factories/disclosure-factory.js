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

const { includes } = require('lodash/fp');
const { addYears } = require('date-fns');
const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const { disclosureRepoPlugin } = require('../repos');
const { initTenantFactory } = require('../../tenants');
const {
  VendorEndpoint,
  VendorEndpointCategory,
  ConfigurationType,
  IdentificationMethods,
} = require('../domains');

const initDisclosureFactory = (app) => {
  const initRepo = disclosureRepoPlugin(app);
  return register('disclosure', async (overrides, { getOrBuild }) => {
    const currentPlusTen = addYears(new Date(), 10);
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const disclosureOverrides = overrides();

    const vendorEndpoint =
      disclosureOverrides?.vendorEndpoint || VendorEndpoint.RECEIVE_APPLICANT;
    const configurationType = await getOrBuild('configurationType', () =>
      includes(vendorEndpoint, VendorEndpointCategory.INSPECTION)
        ? ConfigurationType.INSPECTION
        : ConfigurationType.ISSUING
    );

    let types;
    if (
      !includes(
        IdentificationMethods.PREAUTH,
        disclosureOverrides.identificationMethods
      )
    ) {
      types = [
        { type: 'PastEmploymentPosition' },
        { type: 'CurrentEmploymentPosition' },
      ];
    }
    return {
      item: {
        description: 'Clerk',
        ...buildTypesOrPresentationDefinition({
          types,
          presentationDefinition: disclosureOverrides.presentationDefinition,
        }),
        tenantId: new ObjectId(tenant._id),
        vendorDisclosureId: 'HR-PKG-USPS-CLRK',
        purpose: 'Job Application',
        duration: '6y',
        termsUrl: 'https://www.lipsum.com/feed/html',
        sendPushOnVerification: false,
        deactivationDate: currentPlusTen,
        authTokensExpireIn: 10080,
        ...disclosureOverrides,
        vendorEndpoint,
        configurationType,
      },
      repo: initRepo({ tenant: { ...tenant, _id: new ObjectId(tenant._id) } }),
    };
  });
};

const buildTypesOrPresentationDefinition = ({
  types,
  presentationDefinition,
}) => {
  if (!presentationDefinition) {
    return {
      types,
    };
  }
  return {
    presentationDefinition,
  };
};
module.exports = { initDisclosureFactory };
