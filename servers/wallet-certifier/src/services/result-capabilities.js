const { verifyCapability } = require('../domain/capabilities');
const { PublicError } = require('../domain/public-error');

const invalidCapability = () =>
  new PublicError(
    401,
    'invalid_result_capability',
    'The result capability is invalid or expired.',
  );

const loadResultRun = async (runId, context) => {
  const run = await context.db
    .collection('certificationRuns')
    .findOne({ runId });
  if (!run) {
    throw new PublicError(404, 'run_not_found', 'Certification run not found.');
  }
  return run;
};

const matches = (token, expectedHash, context) =>
  Boolean(expectedHash) &&
  verifyCapability(token, context.config.capabilityPepper, expectedHash);

const ensureActiveResult = (run, token, context) => {
  if (
    !token ||
    !run.resultCapabilityExpiresAt ||
    new Date(context.now()) >= run.resultCapabilityExpiresAt
  ) {
    throw invalidCapability();
  }
};

const resolveResultRole = (run, token, context) => {
  ensureActiveResult(run, token, context);
  const applicantHash =
    run.applicantResultCapabilityHash ?? run.resultCapabilityHash;
  if (matches(token, applicantHash, context)) {
    return 'APPLICANT';
  }
  if (matches(token, run.supportResultCapabilityHash, context)) {
    return 'SUPPORT';
  }
  throw invalidCapability();
};

const loadApplicantResultRun = async (runId, token, context) => {
  const run = await loadResultRun(runId, context);
  if (resolveResultRole(run, token, context) !== 'APPLICANT') {
    throw invalidCapability();
  }
  return run;
};

module.exports = { loadApplicantResultRun, loadResultRun, resolveResultRole };
