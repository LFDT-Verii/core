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

const { batchOperations } = require('./fetchers');
const {
  createStakesAccount,
  createEscrowAccount,
} = require('./create-fineract-account');

const createFineractClient = async (
  { profile, didDoc },
  isStakingAccountRequired,
  context
) => {
  const now = new Date();

  const [
    {
      body: { clientId, savingsId },
    },
  ] = await batchOperations(
    {
      clientsToCreate: [
        {
          fullName: profile.name,
          mobileNumber: '',
          externalId: didDoc.id,
          activationDate: now,
          submittedOnDate: now,
        },
      ],
    },
    context
  );

  const escrowAccountId = await createEscrowAccount(
    clientId,
    didDoc.id,
    context
  );

  if (isStakingAccountRequired) {
    const stakesAccountId = await createStakesAccount(
      clientId,
      didDoc.id,
      context
    );

    return {
      escrowAccountId,
      fineractClientId: clientId,
      tokenAccountId: savingsId,
      stakesAccountId,
    };
  }

  return {
    escrowAccountId,
    fineractClientId: clientId,
    tokenAccountId: savingsId,
  };
};

module.exports = { createFineractClient };
