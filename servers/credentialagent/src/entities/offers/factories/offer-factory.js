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

const { register } = require('@spencejs/spence-factories');
const { nanoid } = require('nanoid/non-secure');
const { ObjectId } = require('mongodb');
const { hashOffer } = require('@verii/verii-issuing');
const { offerRepoPlugin } = require('../repos');
const { initTenantFactory } = require('../../tenants');
const { initOfferExchangeFactory } = require('../../exchanges');
const { initUserFactory } = require('../../users');

const initOfferFactory = (app) => {
  const initRepo = offerRepoPlugin(app);
  return register('offer', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const exchange = await getOrBuild(
      'exchange',
      initOfferExchangeFactory(app)
    );
    const user = await getOrBuild('user', initUserFactory(app));
    const unsetVendorUserId = await getOrBuild('_unsetVendorUserId', () => {});
    const credentialSubjectTitle = await getOrBuild(
      'credentialSubjectTitle',
      () => 'Director, Communications (HoloLens & Mixed Reality Experiences)'
    );
    const credentialSubjectType = await getOrBuild(
      'credentialSubjectType',
      () => null
    );
    const credentialSchemaContext = await getOrBuild(
      'credentialSchemaContext',
      () => undefined
    );
    const credentialSubjectDefault = {
      company: tenant.did,
      companyName: {
        localized: {
          en: 'Microsoft Corporation',
        },
      },
      title: {
        localized: {
          en: credentialSubjectTitle,
        },
      },
      startMonthYear: {
        month: 10,
        year: 2010,
      },
      endMonthYear: {
        month: 6,
        year: 2019,
      },
      location: {
        countryCode: 'US',
        regionCode: 'MA',
      },
      description: {
        localized: {
          en: 'l Data, AI, Hybrid, IoT, Datacenter, Mixed Reality/HoloLens, D365, Power Platform - all kinds of fun stuff!',
        },
      },
    };
    const offerContext = await getOrBuild('offerContext', () => undefined);

    const credentialSubject = {
      ...(credentialSchemaContext
        ? { '@context': credentialSchemaContext }
        : {}),
      ...(credentialSubjectType ? { type: credentialSubjectType } : {}),
      vendorUserId: user.vendorUserId,
      ...(await getOrBuild(
        'credentialSubject',
        () => credentialSubjectDefault
      )),
    };

    if (unsetVendorUserId) {
      delete credentialSubject.vendorUserId;
    }

    const item = {
      ...(offerContext ? { '@context': offerContext } : {}),
      type: ['PastEmploymentPosition'],
      issuer: {
        id: tenant.did,
      },
      credentialSubject,
      offerId: nanoid(),
      exchangeId: new ObjectId(exchange._id),
      ...overrides(),
    };
    item.contentHash = {
      type: 'VelocityContentHash2020',
      value: hashOffer(item),
    };

    return {
      item,
      repo: initRepo({ tenant: { ...tenant, _id: new ObjectId(tenant._id) } }),
    };
  });
};

module.exports = { initOfferFactory };
