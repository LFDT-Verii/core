const { randomBytes, randomUUID } = require('node:crypto');
const { hashCapability } = require('../domain/capabilities');
const { PublicError } = require('../domain/public-error');
const { RunStates } = require('../domain/states');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const addDays = (date, days) =>
  new Date(new Date(date).getTime() + days * DAY_IN_MS);

const addYear = (date) => {
  const value = new Date(date);
  value.setUTCFullYear(value.getUTCFullYear() + 1);
  return value;
};

const defaultTokenFactory = () => randomBytes(32).toString('base64url');

const selectWallet = (wallets, walletId) => {
  const wallet = wallets.find(({ id }) => id === walletId);
  if (!wallet) {
    throw new PublicError(400, 'wallet_not_found', 'Wallet was not found.');
  }
  if (!wallet.eligible) {
    throw new PublicError(
      400,
      'wallet_not_supported',
      'Phase one requires Velocity Network support.',
    );
  }
  return wallet;
};

const persistRun = async (db, run, evidence) => {
  await db.collection('certificationRuns').insertOne(run);
  try {
    await db.collection('runEvidence').insertOne(evidence);
  } catch (error) {
    await db.collection('certificationRuns').deleteOne({ runId: run.runId });
    throw error;
  }
};

const createRun = async (
  input,
  {
    config,
    db,
    registrarClient,
    now = () => new Date(),
    runIdFactory = randomUUID,
    tokenFactory = defaultTokenFactory,
  },
) => {
  const wallets = await registrarClient.searchWallets(input.walletId);
  const wallet = selectWallet(wallets, input.walletId);

  const createdAt = new Date(now());
  const runId = runIdFactory();
  const interactionToken = tokenFactory();
  const capabilityExpiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const run = {
    runId,
    capability: input.capability,
    state: RunStates.CREATED,
    walletId: wallet.id,
    walletName: wallet.name,
    walletOrganizationId: wallet.organizationId,
    walletOrganizationName: wallet.organizationName,
    interactionCapabilityHash: hashCapability(
      interactionToken,
      config.capabilityPepper,
    ),
    capabilityExpiresAt,
    revision: 0,
    journal: [{ state: RunStates.CREATED, at: createdAt }],
    createdAt,
    updatedAt: createdAt,
    nextCheckAt: createdAt,
    purgeAt: addYear(createdAt),
  };
  const evidence = {
    runId,
    applicantName: input.applicantName,
    applicantEmail: input.applicantEmail,
    createdAt,
    updatedAt: createdAt,
    purgeAt: addDays(createdAt, 30),
  };

  await persistRun(db, run, evidence);

  return {
    runId,
    interactionToken,
    capabilityExpiresAt: capabilityExpiresAt.toISOString(),
  };
};

module.exports = { createRun };
