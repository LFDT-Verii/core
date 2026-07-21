const { randomBytes } = require('node:crypto');
const { hashCapability } = require('../domain/capabilities');
const { fingerprintJwt } = require('../domain/evidence');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const defaultTokenFactory = () => randomBytes(32).toString('base64url');

const decodeCredential = (jwt) => {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'),
    );
    return payload.vc ?? payload;
  } catch {
    return undefined;
  }
};

const resultUrl = (config, runId, token) =>
  `${config.publicAppUrl}/results/${runId}#token=${token}`;

const notificationMessage = ({ config, run, token, role }) => {
  const status = run.state.toLowerCase().replaceAll('_', ' ');
  if (role === 'APPLICANT') {
    return [
      `Your ${run.capability.toLowerCase()} wallet certification result is ${status}.`,
      `View the result: ${resultUrl(config, run.runId, token)}`,
      'This private link expires in 7 days.',
    ].join('\n\n');
  }
  return [
    `Wallet certification run ${run.runId} completed with status ${status}.`,
    `Review the run: ${config.publicAppUrl}/support/runs/${run.runId}#token=${token}`,
    'This private link expires in 7 days.',
  ].join('\n\n');
};

const queueNotifications = async ({
  run,
  evidence,
  tokens,
  completedAt,
  context,
}) => {
  const jobs = [
    { role: 'APPLICANT', recipient: evidence.applicantEmail },
    { role: 'SUPPORT', recipient: context.config.supportEmail },
  ].map(({ role, recipient }) => ({
    jobId: `${run.runId}:${role}`,
    runId: run.runId,
    role,
    recipient,
    subject: `${context.config.brandName} wallet certification: ${run.state}`,
    message: notificationMessage({
      config: context.config,
      run,
      token: tokens[role],
      role,
    }),
    status: 'PENDING',
    attemptCount: 0,
    nextAttemptAt: completedAt,
    createdAt: completedAt,
    updatedAt: completedAt,
    purgeAt: new Date(completedAt.getTime() + 30 * DAY_IN_MS),
  }));
  await Promise.all(
    jobs.map((job) =>
      context.db
        .collection('notificationJobs')
        .updateOne(
          { jobId: job.jobId },
          { $setOnInsert: job },
          { upsert: true },
        ),
    ),
  );
};

const prepareDisclosure = async ({ run, credential, context }) => {
  const updatedAt = new Date(context.now());
  await context.db.collection('runEvidence').updateOne(
    { runId: run.runId },
    {
      $set: { issuedCredential: credential, updatedAt },
    },
  );
  await context.db.collection('certificationRuns').updateOne(
    { runId: run.runId, state: run.state },
    {
      $set: {
        state: 'PREPARING_DISCLOSURE',
        setupCredentialFingerprint: fingerprintJwt(credential.jwt),
        leaseUntil: null,
        updatedAt,
      },
      $inc: { revision: 1 },
      $push: { journal: { state: 'PREPARING_DISCLOSURE', at: updatedAt } },
      $unset: {
        actionDeadline: '',
        absoluteDeadline: '',
        nextCheckAt: '',
      },
    },
  );
  return context.db
    .collection('certificationRuns')
    .findOne({ runId: run.runId });
};

const persistTerminalEvidence = async ({
  run,
  credential,
  evidenceFields,
  completedAt,
  context,
}) => {
  if (!credential && !evidenceFields) {
    return;
  }
  await context.db.collection('runEvidence').updateOne(
    { runId: run.runId },
    {
      $set: {
        ...(credential ? { issuedCredential: credential } : {}),
        ...evidenceFields,
        updatedAt: completedAt,
      },
    },
  );
};

const terminalFields = ({
  state,
  applicantToken,
  supportToken,
  completedAt,
  credential,
  failure,
  resultSummary,
  context,
}) => ({
  state,
  completedAt,
  resultCapabilityHash: hashCapability(
    applicantToken,
    context.config.capabilityPepper,
  ),
  applicantResultCapabilityHash: hashCapability(
    applicantToken,
    context.config.capabilityPepper,
  ),
  supportResultCapabilityHash: hashCapability(
    supportToken,
    context.config.capabilityPepper,
  ),
  resultCapabilityExpiresAt: new Date(completedAt.getTime() + 7 * DAY_IN_MS),
  ...(credential
    ? { setupCredentialFingerprint: fingerprintJwt(credential.jwt) }
    : {}),
  ...(failure ? { failure } : {}),
  ...(resultSummary ? { resultSummary } : {}),
  leaseUntil: null,
  updatedAt: completedAt,
});

const completeRun = async ({
  run,
  state,
  failure,
  credential,
  evidenceFields,
  resultSummary,
  context,
}) => {
  const completedAt = new Date(context.now());
  const createToken = context.tokenFactory ?? defaultTokenFactory;
  const tokens = {
    APPLICANT: createToken(),
    SUPPORT: createToken(),
  };
  const evidence = await context.db.collection('runEvidence').findOne({
    runId: run.runId,
  });
  await persistTerminalEvidence({
    run,
    credential,
    evidenceFields,
    completedAt,
    context,
  });
  const terminalRun = {
    ...run,
    state,
    ...(failure ? { failure } : {}),
  };
  await queueNotifications({
    run: terminalRun,
    evidence,
    tokens,
    completedAt,
    context,
  });
  await context.db.collection('certificationRuns').updateOne(
    { runId: run.runId, state: run.state },
    {
      $set: {
        ...terminalFields({
          state,
          applicantToken: tokens.APPLICANT,
          supportToken: tokens.SUPPORT,
          completedAt,
          credential,
          failure,
          resultSummary,
          context,
        }),
      },
      $inc: { revision: 1 },
      $push: { journal: { state, at: completedAt } },
      $unset: { nextCheckAt: '' },
    },
  );
  return context.db
    .collection('certificationRuns')
    .findOne({ runId: run.runId });
};

const credentialResult = (hubCredential) => ({
  issuedAt: hubCredential.acceptedAt,
  json: decodeCredential(hubCredential.jwtVc),
  jwt: hubCredential.jwtVc,
});

module.exports = {
  completeRun,
  credentialResult,
  decodeCredential,
  prepareDisclosure,
};
