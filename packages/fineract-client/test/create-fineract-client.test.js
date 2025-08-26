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

const nock = require('nock');
const { initHttpClient } = require('@verii/http-client');
const { ProductIds, createFineractClient } = require('../src');

const testHost = 'https://localhost.test';

describe('create clients', () => {
  const didDoc = { id: 'did:ion:1234' };
  const profile = { name: 'ACME Corp' };
  let context;

  beforeAll(async () => {
    const baseContext = { log: console };
    const fineractFetch = initHttpClient({
      prefixUrl: testHost,
      useExistingGlobalAgent: true,
    })(testHost, baseContext);
    context = { ...baseContext, fineractFetch };
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  it('should be able to create a client and basic accounts', async () => {
    const webhookPayloads = [];
    let savingsCounter = 1;
    const expectResults = {
      fineractClientId: '100',
      tokenAccountId: '1',
      escrowAccountId: '2',
    };
    nock(testHost)
      .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
      .reply(200, async (request) => {
        const body = await request.json();
        webhookPayloads.push(body.json);
        return [
          {
            statusCode: 200,
            body: `{"clientId":100, "savingsId": ${savingsCounter}}`,
          },
        ];
      });
    nock(testHost)
      .post('/fineract-provider/api/v1/savingsaccounts')
      .reply(200, async (request) => {
        const body = await request.json();
        webhookPayloads.push(body.json);
        savingsCounter += 1;
        return {
          officeId: 1,
          clientId: body.json.clientId,
          savingsId: savingsCounter,
          resourceId: 9,
          gsimId: 0,
        };
      });

    const result = await createFineractClient(
      {
        profile,
        didDoc,
      },
      false,
      context
    );
    expect(result).toEqual(expectResults);
    expect(webhookPayloads).toEqual([
      [expectedClientRequest],
      {
        ...expectedSavingsAccountRequest,
        externalId: `${didDoc.id}#escrow-account`,
        productId: ProductIds.ESCROW,
      },
    ]);
  });
  it('should be able to create a client, basic and staking accounts', async () => {
    const webhookPayloads = [];
    let savingsCounter = 1;
    const expectResults = {
      fineractClientId: '100',
      tokenAccountId: '1',
      escrowAccountId: '2',
      stakesAccountId: '3',
    };
    nock(testHost)
      .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
      .reply(200, async (request) => {
        const body = await request.json();
        webhookPayloads.push(body.json);
        return [
          {
            statusCode: 200,
            body: `{"clientId":100, "savingsId": ${savingsCounter}}`,
          },
        ];
      });
    nock(testHost)
      .post('/fineract-provider/api/v1/savingsaccounts')
      .twice()
      .reply(200, async (request) => {
        const body = await request.json();
        webhookPayloads.push(body.json);
        savingsCounter += 1;
        return {
          officeId: 1,
          clientId: body.json.clientId,
          savingsId: savingsCounter,
          resourceId: 9,
          gsimId: 0,
        };
      });

    const result = await createFineractClient(
      {
        profile,
        didDoc,
      },
      true,
      context
    );
    expect(result).toEqual(expectResults);
    expect(webhookPayloads).toEqual([
      [expectedClientRequest],
      {
        ...expectedSavingsAccountRequest,
        externalId: `${didDoc.id}#escrow-account`,
        productId: ProductIds.ESCROW,
      },
      {
        ...expectedSavingsAccountRequest,
        externalId: `${didDoc.id}#stakes-account`,
        productId: ProductIds.STAKES,
      },
    ]);
  });

  const todaysDate = new Date().toISOString().substring(0, 10);

  const expectedClientRequest = {
    body: JSON.stringify({
      officeId: 1,
      legalFormId: 2,
      fullname: profile.name,
      mobileNo: '',
      externalId: didDoc.id,
      active: true,
      locale: 'en',
      dateFormat: 'yyyy-MM-dd',
      activationDate: todaysDate,
      submittedOnDate: todaysDate,
      savingsProductId: 1,
    }),
    method: 'POST',
    relativeUrl: 'clients',
    requestId: expect.any(Number),
  };

  const expectedSavingsAccountRequest = {
    allowOverdraft: false,
    autoApproveAndActivate: true,
    charges: [],
    clientId: 100,
    dateFormat: 'yyyy-MM-dd',
    enforceMinRequiredBalance: false,
    interestCalculationDaysInYearType: 365,
    interestCalculationType: 1,
    interestCompoundingPeriodType: 1,
    interestPostingPeriodType: 4,
    locale: 'en',
    monthDayFormat: 'MM-dd',
    nominalAnnualInterestRate: 0,
    submittedOnDate: todaysDate,
    withHoldTax: false,
    withdrawalFeeForTransfers: false,
  };
});
