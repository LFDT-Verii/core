const { RunStates } = require('../domain/states');
const { processNotificationJobs } = require('./process-notifications');
const { reconcileRun } = require('./reconcile-run');

const RECONCILABLE_STATES = [
  RunStates.ISSUING,
  RunStates.DISCLOSING,
  RunStates.FINALIZING,
];

const dueRuns = (context) => {
  const now = new Date(context.now());
  return context.repositories.certificationRuns.findDue({
    now,
    states: RECONCILABLE_STATES,
    limit: 25,
  });
};

const monitorRuns = async (context) => {
  const runs = await dueRuns(context);
  const results = await Promise.allSettled(
    runs.map((run) => reconcileRun(run, context)),
  );
  const reconciled = results.filter(
    ({ status }) => status === 'fulfilled',
  ).length;
  const failures = results.length - reconciled;
  const notifications = await processNotificationJobs(context);
  return {
    reconciled,
    notificationsProcessed: notifications.processed,
    failures,
  };
};

module.exports = { monitorRuns };
