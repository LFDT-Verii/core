const RunStates = Object.freeze({
  CREATED: 'CREATED',
  ISSUING: 'ISSUING',
  DISCLOSING: 'DISCLOSING',
  FINALIZING: 'FINALIZING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  TIMED_OUT: 'TIMED_OUT',
  ERROR: 'ERROR',
});

const TerminalRunStates = new Set([
  RunStates.PASSED,
  RunStates.FAILED,
  RunStates.REJECTED,
  RunStates.TIMED_OUT,
  RunStates.ERROR,
]);

module.exports = { RunStates, TerminalRunStates };
