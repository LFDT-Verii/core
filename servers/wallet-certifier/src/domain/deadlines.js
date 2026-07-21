const { RunStates, TerminalRunStates } = require('./states');

const MINUTE_IN_MS = 60 * 1000;

const newDeadlines = (startedAt) => {
  const startedAtMs = new Date(startedAt).getTime();
  return {
    actionDeadline: new Date(startedAtMs + 10 * MINUTE_IN_MS).toISOString(),
    absoluteDeadline: new Date(startedAtMs + 15 * MINUTE_IN_MS).toISOString(),
  };
};

const hasTimelyWalletActivity = (exchange, actionDeadline) =>
  (exchange?.events ?? []).some(
    ({ state, timestamp }) =>
      state !== 'NEW' && new Date(timestamp) <= new Date(actionDeadline),
  );

const classifyDeadline = (run, exchange, now) => {
  if (TerminalRunStates.has(run.state)) {
    return run.state;
  }

  const nowTime = new Date(now).getTime();
  if (nowTime >= new Date(run.absoluteDeadline).getTime()) {
    return RunStates.TIMED_OUT;
  }
  if (nowTime < new Date(run.actionDeadline).getTime()) {
    return run.state;
  }
  if (hasTimelyWalletActivity(exchange, run.actionDeadline)) {
    return RunStates.FINALIZING;
  }
  return RunStates.TIMED_OUT;
};

module.exports = { classifyDeadline, newDeadlines };
