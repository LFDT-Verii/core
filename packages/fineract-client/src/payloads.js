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

const { formatAsDate } = require('@verii/common-functions');
const { ProductIds } = require('./constants');

const creditProductId = 1;
const accountTypeSavings = 2;

const buildCreateClientPayload = ({
  fullName,
  mobileNumber,
  externalId,
  activationDate,
  submittedOnDate,
}) => {
  return {
    // address: [],
    // familyMembers: [],
    officeId: 1,
    legalFormId: 2,
    fullname: fullName,
    mobileNo: mobileNumber,
    externalId,
    active: true,
    locale: 'en',
    dateFormat: 'yyyy-MM-dd',
    activationDate: formatAsDate(activationDate),
    submittedOnDate: formatAsDate(submittedOnDate),
    // dateOfBirth: '01 January 2021',
    // savingsProductId: null,
  };
};

const buildCreateCreditsAccountPayload = ({
  clientId,
  externalId,
  submittedOnDate,
  productId = ProductIds.VELOCITY_CREDITS,
  autoApproveAndActivate = true,
}) => {
  return {
    productId,
    clientId: Number(clientId),
    dateFormat: 'yyyy-MM-dd',
    submittedOnDate: formatAsDate(submittedOnDate),
    externalId,
    autoApproveAndActivate,
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
  };
};

const buildTransferCreditsPayload = ({
  fromAccount,
  toAccount,
  amount,
  description,
}) => {
  const now = new Date();
  return {
    fromAccountId: Number(fromAccount),
    fromAccountType: accountTypeSavings,
    fromOfficeId: 1,
    toOfficeId: 1,
    toAccountType: accountTypeSavings,
    toAccountId: Number(toAccount),
    transferAmount: `${amount}`,
    transferDate: formatAsDate(now),
    dateFormat: 'yyyy-MM-dd',
    transferDescription: description,
    locale: 'en',
  };
};

const buildBurnVouchersPayload = ({ quantity, submittedOnDate }) => {
  return {
    quantity: `${quantity}`,
    dateFormat: 'yyyy-MM-dd',
    submittedOnDate: formatAsDate(submittedOnDate),
    locale: 'en',
  };
};

const initBuildBatchCreateClientPayload =
  ({ requestId, autoAccountCreation = true }) =>
  ({ fullName, mobileNumber, externalId, activationDate, submittedOnDate }) => {
    const clientPayload = buildCreateClientPayload({
      fullName,
      mobileNumber,
      externalId,
      activationDate,
      submittedOnDate,
    });
    return {
      requestId,
      relativeUrl: 'clients',
      method: 'POST',
      body: JSON.stringify({
        ...clientPayload,
        savingsProductId: autoAccountCreation ? creditProductId : undefined,
      }),
    };
  };

const initBuildBatchCreateCreditsAccountPayload =
  ({ requestId }) =>
  ({
    clientId,
    externalId,
    submittedOnDate,
    productId,
    autoApproveAndActivate,
  }) => {
    return {
      requestId,
      relativeUrl: 'savingsaccounts',
      method: 'POST',
      body: JSON.stringify(
        buildCreateCreditsAccountPayload({
          clientId,
          externalId,
          submittedOnDate,
          productId,
          autoApproveAndActivate,
        }),
      ),
    };
  };

const initBuildBatchTransferCreditsPayload =
  ({ requestId }) =>
  ({ fromAccount, toAccount, amount, description }) => {
    return {
      requestId,
      relativeUrl: 'accounttransfers',
      method: 'POST',
      body: JSON.stringify(
        buildTransferCreditsPayload({
          fromAccount,
          toAccount,
          amount,
          description,
        }),
      ),
    };
  };

const initBuildBatchBurnVouchersPayload =
  ({ requestId }) =>
  ({ quantity, submittedOnDate, clientId }) => {
    return {
      requestId,
      relativeUrl: `vouchers/${clientId}`,
      method: 'POST',
      body: JSON.stringify(
        buildBurnVouchersPayload({ quantity, submittedOnDate }),
      ),
    };
  };

module.exports = {
  buildCreateClientPayload,
  buildCreateCreditsAccountPayload,
  buildTransferCreditsPayload,
  buildBurnVouchersPayload,
  initBuildBatchCreateClientPayload,
  initBuildBatchCreateCreditsAccountPayload,
  initBuildBatchTransferCreditsPayload,
  initBuildBatchBurnVouchersPayload,
};
