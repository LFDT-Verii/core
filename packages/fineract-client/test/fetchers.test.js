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
const { startOfDay, subDays } = require('date-fns/fp');
const { formatAsDate } = require('@verii/common-functions');
const { initHttpClient } = require('@verii/http-client');
const {
  ISO_DATETIME_FORMAT_ONLY_DATE_SECTION,
} = require('@verii/test-regexes');
const {
  batchOperations,
  batchTransferCredits,
  createClient,
  createCreditsAccount,
  createVouchers,
  getClientVoucherBalance,
  getCreditsAccount,
  getCreditsAccountTransactions,
  transferCredits,
  buildTransferCreditsPayload,
  buildCreateClientPayload,
  buildCreateCreditsAccountPayload,
  buildBurnVouchersPayload,
  ProductIds,
  getVouchers,
  getExpiringVouchers,
} = require('../src');

const testHost = 'https://localhost.test';

describe('fineract client test suite', () => {
  let fineractFetch;

  beforeAll(async () => {
    fineractFetch = initHttpClient({
      prefixUrl: testHost,
    })({ log: console });
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  afterAll(() => {
    nock.restore();
  });

  describe('batch fineract operations test suite', () => {
    it('Should create 2 credit transfers against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [{ statusCode: 200, body: '{"clientId":1}' }];
        });
      const transfer1 = {
        fromAccount: '1',
        toAccount: '2',
        amount: '18',
        description: 'test transfer 1',
      };
      const transfer2 = {
        fromAccount: '3',
        toAccount: '4',
        amount: '36',
        description: 'test transfer 2',
      };
      const func = () => {
        return batchOperations(
          {
            transfers: [transfer1, transfer2],
          },
          { fineractFetch }
        );
      };
      await expect(func()).resolves.toEqual(expect.any(Array));
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer1)),
        },
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer2)),
        },
      ]);
    });
    it('Should handle error when a single transfer of a transactional batch fails against mock fineract api', async () => {
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, () => {
          return [
            {
              statusCode: 400,
              // eslint-disable-next-line max-len
              body: 'Transaction is being rolled back. First erroneous request: \n{"requestId":8920108036187830,"statusCode":500,"body":"{\\n  \\"developerMessage\\": \\"Request was understood but caused a domain rule violation.\\",\\n  \\"httpStatusCode\\": \\"403\\",\\n  \\"defaultUserMessage\\": \\"Errors contain reason for domain rule violation.\\",\\n  \\"userMessageGlobalisationCode\\": \\"validation.msg.domain.rule.violation\\",\\n  \\"errors\\": [\\n    {\\n      \\"developerMessage\\": \\"Insufficient account balance.\\",\\n      \\"defaultUserMessage\\": \\"Insufficient account balance.\\",\\n      \\"userMessageGlobalisationCode\\": \\"error.msg.savingsaccount.transaction.insufficient.account.balance\\",\\n      \\"parameterName\\": \\"id\\",\\n      \\"args\\": [\\n        {\\n          \\"value\\": \\"transactionAmount\\"\\n        },\\n        {\\n          \\"value\\": -10.00\\n        },\\n        {},\\n        {\\n          \\"value\\": 10\\n        }\\n      ]\\n    }\\n  ]\\n}"}',
            },
          ];
        });
      const transfer1 = {
        fromAccount: '1',
        toAccount: '2',
        amount: '18',
        description: 'test transfer 1',
      };
      const transfer2 = {
        fromAccount: '3',
        toAccount: '4',
        amount: '36',
        description: 'test transfer 2',
      };
      const func = () => {
        return batchOperations(
          {
            transfers: [transfer1, transfer2],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).rejects.toThrow('Transaction is being rolled back');
    });
    it('Should handle error when a single transfer of a non-transactional batch fails against mock fineract api', async () => {
      let webhookPayload;

      nock(testHost)
        .post('/fineract-provider/api/v1/batches?')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [
            { statusCode: 200, body: '{"clientId":1}' },
            {
              statusCode: 400,
              // eslint-disable-next-line max-len
              body: '{"foo":"foo"}',
            },
          ];
        });
      const transfer1 = {
        fromAccount: '1',
        toAccount: '2',
        amount: '18',
        description: 'test transfer 1',
      };
      const transfer2 = {
        fromAccount: '3',
        toAccount: '4',
        amount: '36',
        description: 'test transfer 2',
      };
      const result = await batchOperations(
        {
          transfers: [transfer1, transfer2],
          transactionalBatch: false,
        },
        {
          fineractFetch,
        }
      );
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer1)),
        },
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer2)),
        },
      ]);
      await expect(result).toEqual([
        {
          statusCode: 200,
          body: {
            clientId: '1',
          },
        },
        {
          statusCode: 400,
          body: { foo: 'foo' },
        },
      ]);
    });
    it('Should handle a non-JSON error during a batch failure against mock fineract api', async () => {
      let webhookPayload;

      nock(testHost)
        .post('/fineract-provider/api/v1/batches?')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [
            { statusCode: 200, body: '{"clientId":1}' },
            {
              statusCode: 400,
              // eslint-disable-next-line max-len
              body: 'foo error',
            },
          ];
        });
      const transfer1 = {
        fromAccount: '1',
        toAccount: '2',
        amount: '18',
        description: 'test transfer 1',
      };
      const transfer2 = {
        fromAccount: '3',
        toAccount: '4',
        amount: '36',
        description: 'test transfer 2',
      };
      const result = await batchOperations(
        {
          transfers: [transfer1, transfer2],
          transactionalBatch: false,
        },
        {
          fineractFetch,
        }
      );
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer1)),
        },
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer2)),
        },
      ]);
      await expect(result).toEqual([
        {
          statusCode: 200,
          body: {
            clientId: '1',
          },
        },
        {
          statusCode: 400,
          body: { message: 'foo error' },
        },
      ]);
    });
    it('Should create a client and associated account against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [{ statusCode: 200, body: '{"clientId":1}' }];
        });
      const now = new Date();
      const client1 = {
        fullName: 'test client 1',
        externalId: 'a',
        activationDate: now,
        submittedOnDate: now,
      };

      const creditsAccount1 = {
        clientId: '1',
        externalId: 'a1',
        submittedOnDate: now,
      };

      const func = () => {
        return batchOperations(
          {
            clientsToCreate: [client1],
            creditAccountsToCreate: [creditsAccount1],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(expect.any(Array));
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'clients',
          method: 'POST',
          body: JSON.stringify({
            ...buildCreateClientPayload(client1),
            savingsProductId: 1,
          }),
        },
        {
          requestId: expect.any(Number),
          relativeUrl: 'savingsaccounts',
          method: 'POST',
          body: JSON.stringify(
            buildCreateCreditsAccountPayload(creditsAccount1)
          ),
        },
      ]);
    });
    it('Should burn vouchers for a client against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [{ statusCode: 200, body: '{"clientId":1}' }];
        });
      const now = new Date();
      const burnVoucherInput = {
        quantity: 100,
        clientId: '1',
        submittedOnDate: now,
      };

      const func = () => {
        return batchOperations(
          {
            clientVoucherBurns: [burnVoucherInput],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(expect.any(Array));
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: `vouchers/${burnVoucherInput.clientId}`,
          method: 'POST',
          body: JSON.stringify(buildBurnVouchersPayload(burnVoucherInput)),
        },
      ]);
    });
    it('Should create a client and implicit associated account against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [
            {
              requestId: 1,
              statusCode: 200,
              body: '{"officeId":1,"clientId":30,"savingsId":30,"resourceId":30}',
            },
          ];
        });
      const now = new Date();
      const client1 = {
        fullName: 'test client 1',
        externalId: 'a',
        activationDate: now,
        submittedOnDate: now,
      };

      const func = () => {
        return batchOperations(
          {
            clientsToCreate: [client1],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual([
        {
          requestId: 1,
          statusCode: 200,
          body: {
            officeId: 1,
            clientId: '30',
            savingsId: '30',
            resourceId: 30,
          },
        },
      ]);
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'clients',
          method: 'POST',
          body: JSON.stringify({
            ...buildCreateClientPayload(client1),
            savingsProductId: 1,
          }),
        },
      ]);
    });
    it('Should create an account with Stakes product id against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [{ statusCode: 200, body: '{"savingsId":1}' }];
        });
      const now = new Date();

      const creditsAccount1 = {
        clientId: '1',
        externalId: 'a1',
        submittedOnDate: now,
        productId: ProductIds.STAKES,
      };

      const func = () => {
        return batchOperations(
          {
            creditAccountsToCreate: [creditsAccount1],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(expect.any(Array));
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'savingsaccounts',
          method: 'POST',
          body: JSON.stringify(
            buildCreateCreditsAccountPayload(creditsAccount1)
          ),
        },
      ]);
      const parsedBody = JSON.parse(webhookPayload[0].body);

      expect(parsedBody).toMatchObject({ productId: ProductIds.STAKES });
    });
  });

  describe('batch fineract credits transfer test suite', () => {
    it('Should create 2 credit transfers against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/batches?enclosingTransaction=true')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return [{ statusCode: 200, body: '{"clientId":1}' }];
        });
      const transfer1 = {
        fromAccount: '1',
        toAccount: '2',
        amount: '18',
        description: 'test transfer 1',
      };
      const transfer2 = {
        fromAccount: '3',
        toAccount: '4',
        amount: '36',
        description: 'test transfer 2',
      };
      const func = () => {
        return batchTransferCredits(
          {
            transfers: [transfer1, transfer2],
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(expect.any(Array));
      expect(webhookPayload).toEqual([
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer1)),
        },
        {
          requestId: expect.any(Number),
          relativeUrl: 'accounttransfers',
          method: 'POST',
          body: JSON.stringify(buildTransferCreditsPayload(transfer2)),
        },
      ]);
    });
  });

  describe('Create fineract client test suite', () => {
    it('Should create a client against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/clients')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return { officeId: 1, clientId: 1, resourceId: 21 };
        });
      const func = () => {
        const now = new Date();
        return createClient(
          {
            fullName: 'Fetcher test 1',
            mobileNumber: '123456789',
            externalId: 'did:ion:fetcher123',
            activationDate: now,
            submittedOnDate: now,
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual({ clientId: '1' });
      expect(webhookPayload).toEqual({
        officeId: 1,
        legalFormId: 2,
        fullname: 'Fetcher test 1',
        mobileNo: '123456789',
        externalId: 'did:ion:fetcher123',
        active: true,
        locale: 'en',
        dateFormat: 'yyyy-MM-dd',
        activationDate: expect.stringMatching(
          ISO_DATETIME_FORMAT_ONLY_DATE_SECTION
        ),
        submittedOnDate: expect.stringMatching(
          ISO_DATETIME_FORMAT_ONLY_DATE_SECTION
        ),
      });
    });
  });

  describe('Create fineract credits account test suite', () => {
    it('Should create a credits account with default product against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/savingsaccounts')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return {
            officeId: 1,
            clientId: 2,
            savingsId: 9,
            resourceId: 9,
            gsimId: 0,
          };
        });
      const clientId = '1';
      const externalId = 'creditaccount1';
      const func = () => {
        return createCreditsAccount(
          {
            clientId,
            externalId,
            submittedOnDate: new Date(),
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual({ tokenAccountId: '9' });
      expect(webhookPayload).toEqual({
        productId: 1,
        clientId: Number(clientId),
        dateFormat: 'yyyy-MM-dd',
        submittedOnDate: expect.stringMatching(
          ISO_DATETIME_FORMAT_ONLY_DATE_SECTION
        ),
        externalId,
        autoApproveAndActivate: true,
        nominalAnnualInterestRate: 0,
        withdrawalFeeForTransfers: false,
        allowOverdraft: false,
        enforceMinRequiredBalance: false,
        withHoldTax: false,
        interestCompoundingPeriodType: 1,
        interestPostingPeriodType: 4,
        interestCalculationType: 1,
        interestCalculationDaysInYearType: 365,
        locale: 'en',
        monthDayFormat: 'MM-dd',
        charges: [],
      });
    });

    it('Should create a credits account with stakes product against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/savingsaccounts')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return {
            officeId: 1,
            clientId: 2,
            savingsId: 9,
            resourceId: 9,
            gsimId: 0,
          };
        });
      const clientId = '1';
      const externalId = 'creditaccount1';
      const func = () => {
        return createCreditsAccount(
          {
            clientId,
            externalId,
            submittedOnDate: new Date(),
            productId: ProductIds.STAKES,
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual({ tokenAccountId: '9' });
      expect(webhookPayload).toEqual({
        productId: 2,
        clientId: Number(clientId),
        dateFormat: 'yyyy-MM-dd',
        submittedOnDate: expect.stringMatching(
          ISO_DATETIME_FORMAT_ONLY_DATE_SECTION
        ),
        externalId,
        autoApproveAndActivate: true,
        nominalAnnualInterestRate: 0,
        withdrawalFeeForTransfers: false,
        allowOverdraft: false,
        enforceMinRequiredBalance: false,
        withHoldTax: false,
        interestCompoundingPeriodType: 1,
        interestPostingPeriodType: 4,
        interestCalculationType: 1,
        interestCalculationDaysInYearType: 365,
        locale: 'en',
        monthDayFormat: 'MM-dd',
        charges: [],
      });
    });
    it('Should allow deactivation of autoApproveAndActivate', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/savingsaccounts')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
        });
      const clientId = '1';
      const externalId = 'creditaccount1';
      const func = () => {
        return createCreditsAccount(
          {
            clientId,
            externalId,
            submittedOnDate: new Date(),
            productId: ProductIds.STAKES,
            autoApproveAndActivate: false,
          },
          {
            fineractFetch,
          }
        );
      };
      await func();
      expect(webhookPayload).toMatchObject({
        autoApproveAndActivate: false,
      });
    });
  });

  describe('Create vouchers for client test suite', () => {
    it('Should create a vouchers bundle against mock fineract api', async () => {
      let webhookPayload;
      const quantity = 1212;
      const clientId = '2';
      nock(testHost)
        .post(
          `/fineract-provider/api/v1/datatables/Voucher/${clientId}?genericResultSet=true`
        )
        .reply(200, async (request) => {
          webhookPayload = await request.json();
        });
      const func = () => {
        return createVouchers(
          {
            quantity: 1212,
            clientId,
            expiry: new Date(),
            bundleId: 'abc',
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual('');
      expect(webhookPayload).toEqual({
        couponBundleId: 'abc',
        symbol: 'VVO',
        quantity: `${quantity}`,
        used: '0',
        locale: 'en',
        dateFormat: 'yyyy-MM-dd',
        expiry: expect.stringMatching(ISO_DATETIME_FORMAT_ONLY_DATE_SECTION),
      });
    });
  });

  describe('Get fineract client voucher balance test suite', () => {
    const testBalance = {
      balance: 5000,
    };

    it('Should get client voucher balance account against nocked fineract api', async () => {
      nock(testHost)
        .get('/fineract-provider/api/v1/vouchers/1/balance')
        .reply(200, testBalance);
      const func = () => {
        return getClientVoucherBalance(
          { clientId: 1 },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual({
        ...testBalance,
        clientId: '1',
      });
    });
  });

  describe('Get fineract credits account test suite', () => {
    const testSavingsAccount = {
      id: 9,
      accountNo: '000000009',
      depositType: {
        id: 100,
        code: 'depositAccountType.savingsDeposit',
        value: 'Savings',
      },
      externalId: '9989334D-273E-4FF0-A494-0838CC39765D',
      clientId: 2,
      clientName: 'University of Tel Aviv',
      savingsProductId: 1,
      savingsProductName: 'Velocity Vouchers',
      fieldOfficerId: 0,
      status: {
        id: 100,
        code: 'savingsAccountStatusType.submitted.and.pending.approval',
        value: 'Submitted and pending approval',
        submittedAndPendingApproval: true,
        approved: false,
        rejected: false,
        withdrawnByApplicant: false,
        active: false,
        closed: false,
        prematureClosed: false,
        transferInProgress: false,
        transferOnHold: false,
        matured: false,
      },
      subStatus: {
        id: 0,
        code: 'SavingsAccountSubStatusEnum.none',
        value: 'None',
        none: true,
        inactive: false,
        dormant: false,
        escheat: false,
        block: false,
        blockCredit: false,
        blockDebit: false,
      },
      timeline: {
        submittedOnDate: [2021, 11, 3],
        submittedByUsername: 'mifos',
        submittedByFirstname: 'App',
        submittedByLastname: 'Administrator',
      },
      currency: {
        code: 'USD',
        name: 'US Dollar',
        decimalPlaces: 2,
        inMultiplesOf: 1,
        displaySymbol: '$',
        nameCode: 'currency.USD',
        displayLabel: 'US Dollar ($)',
      },
      nominalAnnualInterestRate: 0.0,
      interestCompoundingPeriodType: {
        id: 1,
        code: 'savings.interest.period.savingsCompoundingInterestPeriodType.daily',
        value: 'Daily',
      },
      interestPostingPeriodType: {
        id: 4,
        code: 'savings.interest.posting.period.savingsPostingInterestPeriodType.monthly',
        value: 'Monthly',
      },
      interestCalculationType: {
        id: 1,
        code: 'savingsInterestCalculationType.dailybalance',
        value: 'Daily Balance',
      },
      interestCalculationDaysInYearType: {
        id: 365,
        code: 'savingsInterestCalculationDaysInYearType.days365',
        value: '365 Days',
      },
      withdrawalFeeForTransfers: false,
      allowOverdraft: false,
      enforceMinRequiredBalance: false,
      withHoldTax: false,
      isDormancyTrackingActive: false,
      summary: {
        currency: {
          code: 'USD',
          name: 'US Dollar',
          decimalPlaces: 2,
          inMultiplesOf: 1,
          displaySymbol: '$',
          nameCode: 'currency.USD',
          displayLabel: 'US Dollar ($)',
        },
        totalInterestPosted: 0,
        accountBalance: 0.0,
        totalOverdraftInterestDerived: 0,
        interestNotPosted: 0,
        availableBalance: 0.0,
      },
    };

    it('Should get a credits account against nocked fineract api', async () => {
      nock(testHost)
        .get('/fineract-provider/api/v1/savingsaccounts/9?associations=all')
        .reply(200, testSavingsAccount);
      const func = () => {
        return getCreditsAccount(
          {
            accountId: '9',
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(testSavingsAccount);
    });
  });

  describe('Get fineract credits account transactions test suite', () => {
    let uriCalled;
    const dateFormat = 'yyyy-MM-dd';
    const locale = 'en';
    it("Should get a credits account's transactions with all filter params", async () => {
      const today = startOfDay(new Date());
      const previousDay1 = subDays(1, today);
      const previousDay2 = subDays(1, previousDay1);
      const description1 = 'test description';
      const description2 = 'second description';
      const payload = {
        accountId: 9,
        fromDate: previousDay2,
        toDate: previousDay1,
        pageNumber: 2,
        pageSize: 10,
        transfersOnly: true,
        descriptions: [description1, description2],
      };
      const mockedItem = {
        id: 1,
      };
      nock(testHost)
        .get(
          `/fineract-provider/api/v1/savingsaccounts/${payload.accountId}/transactions`
        )
        .query(true)
        .reply(200, (request) => {
          uriCalled = request.url;
          return {
            pageItems: [mockedItem],
            totalFilteredRecords: 40,
          };
        });
      const func = () => {
        return getCreditsAccountTransactions(payload, {
          fineractFetch,
          log: { info: () => {} },
        });
      };
      await expect(func()).resolves.toEqual({
        pageItems: [mockedItem],
        totalFilteredRecords: 40,
        nextPageToken: 3,
        prevPageToken: 1,
      });
      const searchParams = new URLSearchParams();
      searchParams.set('dateFormat', dateFormat);
      searchParams.set('locale', locale);
      searchParams.set('fromDate', formatAsDate(previousDay2));
      searchParams.set('toDate', formatAsDate(previousDay1));
      searchParams.set('pageNumber', payload.pageNumber);
      searchParams.set('pageSize', payload.pageSize);
      searchParams.set('transfersOnly', true);
      searchParams.set('description', description1);
      searchParams.append('description', description2);

      expect(uriCalled).toEqual(
        `https://localhost.test/fineract-provider/api/v1/savingsaccounts/${
          payload.accountId
        }/transactions?${searchParams.toString()}`
      );
    });

    it("Should get a credits account's transactions with no date filter params", async () => {
      const description1 = 'test description';
      const description2 = 'second description';
      const payload = {
        accountId: 9,
        pageNumber: 1,
        pageSize: 10,
        transfersOnly: true,
        descriptions: [description1, description2],
      };
      nock(testHost)
        .get(
          `/fineract-provider/api/v1/savingsaccounts/${payload.accountId}/transactions`
        )
        .query(true)
        .reply(200, (request) => {
          uriCalled = request.url;
          return {
            pageItems: [],
            totalFilteredRecords: 0,
          };
        });
      const func = () => {
        return getCreditsAccountTransactions(payload, {
          fineractFetch,
          log: { info: () => {} },
        });
      };
      await expect(func()).resolves.toEqual({
        pageItems: [],
        totalFilteredRecords: 0,
        nextPageToken: '',
        prevPageToken: '',
      });
      const searchParams = new URLSearchParams();
      searchParams.set('dateFormat', dateFormat);
      searchParams.set('locale', locale);
      searchParams.set('pageNumber', payload.pageNumber);
      searchParams.set('pageSize', payload.pageSize);
      searchParams.set('transfersOnly', true);
      searchParams.set('description', description1);
      searchParams.append('description', description2);

      expect(uriCalled).toEqual(
        `https://localhost.test/fineract-provider/api/v1/savingsaccounts/${
          payload.accountId
        }/transactions?${searchParams.toString()}`
      );
    });
  });

  describe('Create fineract transfer credits test suite', () => {
    it('Should transfer credits from an account to an account against mock fineract api', async () => {
      let webhookPayload;
      nock(testHost)
        .post('/fineract-provider/api/v1/accounttransfers')
        .reply(200, async (request) => {
          webhookPayload = await request.json();
          return {};
        });
      const fromAccount = '1';
      const toAccount = '2';
      const amount = '18';
      const description = 'this is a test transfer';
      const func = () => {
        return transferCredits(
          {
            fromAccount,
            toAccount,
            amount,
            description,
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual({});
      expect(webhookPayload).toEqual({
        fromAccountId: Number(fromAccount),
        fromAccountType: 2,
        fromOfficeId: 1,
        toOfficeId: 1,
        toAccountType: 2,
        toAccountId: Number(toAccount),
        transferAmount: `${amount}`,
        transferDate: expect.stringMatching(
          ISO_DATETIME_FORMAT_ONLY_DATE_SECTION
        ),
        dateFormat: 'yyyy-MM-dd',
        transferDescription: description,
        locale: 'en',
      });
    });
  });

  describe('Get vouchers tests', () => {
    let testVouchers;
    beforeAll(() => {
      testVouchers = [
        {
          expiry: [2022, 1, 1],
          quantity: 1,
          used: 1,
        },
      ];
    });
    it('Get vouchers should mapped correctly', async () => {
      nock(testHost)
        .get('/fineract-provider/api/v1/datatables/Voucher/1')
        .reply(200, testVouchers);
      const func = () => {
        return getVouchers(
          {
            clientId: '1',
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual([
        {
          expiry: '2022-01-01',
          quantity: 1,
          used: 1,
        },
      ]);
    });
  });

  describe('Get expiring vouchers tests', () => {
    let testExpiringVouchers;
    beforeAll(() => {
      testExpiringVouchers = [
        {
          quantity: 1,
        },
      ];
    });

    it('Get expired vouchers should mapped correctly', async () => {
      nock(testHost)
        .get('/fineract-provider/api/v1/vouchers/1/expiring/10')
        .reply(200, testExpiringVouchers);
      const func = () => {
        return getExpiringVouchers(
          {
            clientId: '1',
            days: 10,
          },
          {
            fineractFetch,
          }
        );
      };
      await expect(func()).resolves.toEqual(testExpiringVouchers);
    });
  });
});
