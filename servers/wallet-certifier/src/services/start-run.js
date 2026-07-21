const { buildSetupBadge } = require('../domain/badge');
const { verifyCapability } = require('../domain/capabilities');
const { newDeadlines } = require('../domain/deadlines');
const { PublicError } = require('../domain/public-error');
const { RunStates } = require('../domain/states');

const loadAuthorizedRun = async (runId, token, context) => {
  const run = await context.db
    .collection('certificationRuns')
    .findOne({ runId });
  if (!run) {
    throw new PublicError(404, 'run_not_found', 'Certification run not found.');
  }
  const validToken =
    token &&
    verifyCapability(
      token,
      context.config.capabilityPepper,
      run.interactionCapabilityHash,
    );
  if (!validToken || new Date(context.now()) >= run.capabilityExpiresAt) {
    throw new PublicError(
      401,
      'invalid_capability',
      'The interaction capability is invalid or expired.',
    );
  }
  return run;
};

const persistRunFields = async (runId, fields, context) => {
  await context.db.collection('certificationRuns').updateOne(
    { runId },
    {
      $set: { ...fields, updatedAt: new Date(context.now()) },
      $inc: { revision: 1 },
    },
  );
  return context.db.collection('certificationRuns').findOne({ runId });
};

const ensureDepot = async (run, context) => {
  if (run.depotId) {
    return run;
  }
  const depot = await context.hubClient.createDepot({
    serviceId: context.config.issuerServiceId,
    userReference: run.runId,
  });
  return persistRunFields(run.runId, { depotId: depot.id }, context);
};

const ensureSetupCredential = async (run, evidence, context) => {
  if (run.setupCredentialId) {
    return run;
  }
  const content = buildSetupBadge({
    organizationName: context.config.brandName,
    applicantName: evidence.applicantName,
    applicantEmail: evidence.applicantEmail,
    walletName: run.walletName,
    achievementId: context.config.achievementId,
    imageUrl: context.config.badgeImageUrl,
    criteriaUrl: context.config.badgeCriteriaUrl,
  });
  const credential = await context.hubClient.createCredential({
    depotId: run.depotId,
    credentialReference: run.runId,
    content,
  });
  return persistRunFields(
    run.runId,
    { setupCredentialId: credential.id },
    context,
  );
};

const buildVnInteraction = (
  run,
  links,
  startedAt,
  state = RunStates.ISSUING,
) => {
  const redirect = new URL(links.redirectUrl);
  redirect.searchParams.delete('openid4vc_uri');
  redirect.searchParams.set('deeplink', links.vnProtocolLink);
  redirect.searchParams.set('wallet', run.walletId);
  return {
    state,
    redirectUrl: redirect.toString(),
    qrValue: links.vnProtocolLink,
    ...newDeadlines(startedAt),
  };
};

const startDisclosure = async (run, evidence, context) => {
  if (evidence.disclosureInteraction) {
    return evidence.disclosureInteraction;
  }
  const links = await context.hubClient.refreshPresentationLink(
    context.config.relyingPartyServiceId,
    run.depotId,
  );
  const startedAt = new Date(context.now()).toISOString();
  const interaction = buildVnInteraction(
    run,
    links,
    startedAt,
    RunStates.DISCLOSING,
  );
  await context.db.collection('runEvidence').updateOne(
    { runId: run.runId },
    {
      $set: {
        disclosureInteraction: interaction,
        updatedAt: new Date(context.now()),
      },
    },
  );
  await context.db.collection('certificationRuns').updateOne(
    { runId: run.runId, state: RunStates.PREPARING_DISCLOSURE },
    {
      $set: {
        state: RunStates.DISCLOSING,
        interactionPhase: 'DISCLOSING',
        actionDeadline: new Date(interaction.actionDeadline),
        absoluteDeadline: new Date(interaction.absoluteDeadline),
        nextCheckAt: new Date(context.now()),
        updatedAt: new Date(context.now()),
      },
      $inc: { revision: 1 },
      $push: {
        journal: { state: RunStates.DISCLOSING, at: new Date(context.now()) },
      },
    },
  );
  return interaction;
};

const startRun = async (runId, token, context) => {
  let run = await loadAuthorizedRun(runId, token, context);
  const evidence = await context.db
    .collection('runEvidence')
    .findOne({ runId });
  if (run.state === RunStates.PREPARING_DISCLOSURE) {
    return startDisclosure(run, evidence, context);
  }
  if (evidence.disclosureInteraction) {
    return evidence.disclosureInteraction;
  }
  if (evidence.issueInteraction) {
    return evidence.issueInteraction;
  }

  run = await ensureDepot(run, context);
  run = await ensureSetupCredential(run, evidence, context);
  const links = await context.hubClient.refreshIssueLink(
    context.config.issuerServiceId,
    run.depotId,
  );
  const startedAt = new Date(context.now()).toISOString();
  const interaction = buildVnInteraction(run, links, startedAt);
  await context.db.collection('runEvidence').updateOne(
    { runId },
    {
      $set: {
        issueInteraction: interaction,
        updatedAt: new Date(context.now()),
      },
    },
  );
  await context.db.collection('certificationRuns').updateOne(
    { runId },
    {
      $set: {
        state: RunStates.ISSUING,
        interactionPhase: 'ISSUING',
        actionDeadline: new Date(interaction.actionDeadline),
        absoluteDeadline: new Date(interaction.absoluteDeadline),
        nextCheckAt: new Date(context.now()),
        updatedAt: new Date(context.now()),
      },
      $inc: { revision: 1 },
      $push: {
        journal: { state: RunStates.ISSUING, at: new Date(context.now()) },
      },
    },
  );
  return interaction;
};

module.exports = { buildVnInteraction, loadAuthorizedRun, startRun };
