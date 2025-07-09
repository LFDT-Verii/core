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

const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const { addDays, addHours } = require('date-fns/fp');

// eslint-disable-next-line max-len
const initOrganizationFactory = require('@verii/endpoints-organizations-registrar/src/entities/organizations/factories/organizations-factory');

const purchaseRepoPlugin = require('../../src/entities/purchases/repo');
const { PurchaseStatus } = require('../../src/entities');

module.exports = (app) =>
  register(
    'purchase',
    purchaseRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const organization = await getOrBuild(
        'organization',
        initOrganizationFactory(app)
      );

      const now = new Date();

      const overrideObj = overrides();

      return {
        purchaseId: new ObjectId(),
        userId: `auth0|${new ObjectId().toString()}`,
        exchangeOrderId: '222asdq',
        quoteMetadata: {
          quoteId: new ObjectId(),
          at: now,
          expires: addHours(1, now),
        },
        couponBundle: {
          couponBundleId: '0x01',
          symbol: 'VVO',
          quantity: 100,
          used: 0,
          expiry: addDays(30, now),
          at: now,
          updatedAt: now,
        },
        fiatReceipt: overrideObj.creditReceipt
          ? undefined
          : {
              symbol: 'USD',
              at: now,
              subtotal: '3000',
              feesTotal: '55',
              taxesTotal: '0',
              payMethodId: 'abc',
              total: '3055',
              averagePricePerUnit: '31',
            },
        purchaseEvents: [
          { state: PurchaseStatus.COUPONS_RECONCILED, timestamp: new Date() },
        ],
        at: now,
        updatedAt: now,
        clientId: organization.ids.brokerClientId,
        ...overrideObj,
      };
    }
  );
