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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const nock = require('nock');
const { initHttpClient } = require('@verii/http-client');
const {
  ProductIds,
  createStakesAccount,
  createEscrowAccount,
} = require('../src');

const testHost = 'https://localhost.test';

describe('create client accounts', () => {
  const didDoc = { id: 'did:ion:1234' };
  let context;

  before(async () => {
    const baseContext = { log: console };
    const fineractFetch = initHttpClient({
      prefixUrl: testHost,
      isTest: true,
    })(testHost, baseContext);
    context = { ...baseContext, fineractFetch };
  });

  beforeEach(async () => {
    nock.cleanAll();
  });

  after(() => {
    nock.cleanAll();
    nock.restore();
  });

  it('should be able to create a stakes account', async () => {
    let webhookPayload;
    nock(testHost)
      .post('/fineract-provider/api/v1/savingsaccounts')
      .reply(200, async (request) => {
        webhookPayload = await request.json();
        return {
          officeId: 1,
          clientId: 30,
          savingsId: 9,
          resourceId: 9,
          gsimId: 0,
        };
      });

    const stakesAccountId = await createStakesAccount(30, didDoc.id, context);
    expect(stakesAccountId).toEqual('9');
    expect(webhookPayload).toEqual({
      ...expectedSavingsAccountRequest,
      externalId: `${didDoc.id}#stakes-account`,
      productId: ProductIds.STAKES,
    });
  });
  it('should be able to create a escrow account', async () => {
    let webhookPayload;
    nock(testHost)
      .post('/fineract-provider/api/v1/savingsaccounts')
      .reply(200, async (request) => {
        webhookPayload = await request.json();
        return {
          officeId: 1,
          clientId: 30,
          savingsId: 19,
          resourceId: 9,
          gsimId: 0,
        };
      });

    const stakesAccountId = await createEscrowAccount(30, didDoc.id, context);
    expect(stakesAccountId).toEqual('19');
    expect(webhookPayload).toEqual({
      ...expectedSavingsAccountRequest,
      externalId: `${didDoc.id}#escrow-account`,
      productId: ProductIds.ESCROW,
    });
  });
});

const expectedSavingsAccountRequest = {
  allowOverdraft: false,
  autoApproveAndActivate: true,
  charges: [],
  clientId: 30,
  dateFormat: 'yyyy-MM-dd',
  enforceMinRequiredBalance: false,
  interestCalculationDaysInYearType: 365,
  interestCalculationType: 1,
  interestCompoundingPeriodType: 1,
  interestPostingPeriodType: 4,
  locale: 'en',
  monthDayFormat: 'MM-dd',
  nominalAnnualInterestRate: 0,
  submittedOnDate: new Date().toISOString().substring(0, 10),
  withHoldTax: false,
  withdrawalFeeForTransfers: false,
};
