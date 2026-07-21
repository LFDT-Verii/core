const { describe, it } = require('node:test');
const { expect } = require('expect');
const { RunStates } = require('../../src/domain/states');
const {
  classifyDeadline,
  newDeadlines,
} = require('../../src/domain/deadlines');

describe('certification deadlines', () => {
  it('creates ten-minute action and fifteen-minute absolute deadlines', () => {
    expect(newDeadlines('2026-07-21T01:00:00.000Z')).toEqual({
      actionDeadline: '2026-07-21T01:10:00.000Z',
      absoluteDeadline: '2026-07-21T01:15:00.000Z',
    });
  });

  it('keeps a run active before the action deadline', () => {
    expect(
      classifyDeadline(
        {
          state: RunStates.ISSUING,
          actionDeadline: '2026-07-21T01:10:00.000Z',
          absoluteDeadline: '2026-07-21T01:15:00.000Z',
        },
        null,
        '2026-07-21T01:09:59.000Z',
      ),
    ).toEqual(RunStates.ISSUING);
  });

  it('times out when no wallet action happened within ten minutes', () => {
    expect(
      classifyDeadline(
        {
          state: RunStates.ISSUING,
          actionDeadline: '2026-07-21T01:10:00.000Z',
          absoluteDeadline: '2026-07-21T01:15:00.000Z',
        },
        { events: [{ state: 'NEW', timestamp: '2026-07-21T01:00:01.000Z' }] },
        '2026-07-21T01:10:00.000Z',
      ),
    ).toEqual(RunStates.TIMED_OUT);
  });

  it('allows finalization after timely wallet activity', () => {
    expect(
      classifyDeadline(
        {
          state: RunStates.ISSUING,
          actionDeadline: '2026-07-21T01:10:00.000Z',
          absoluteDeadline: '2026-07-21T01:15:00.000Z',
        },
        {
          events: [
            { state: 'NEW', timestamp: '2026-07-21T01:00:01.000Z' },
            {
              state: 'CLAIMING_IN_PROGRESS',
              timestamp: '2026-07-21T01:09:59.000Z',
            },
          ],
        },
        '2026-07-21T01:12:00.000Z',
      ),
    ).toEqual(RunStates.FINALIZING);
  });

  it('enforces the absolute fifteen-minute deadline', () => {
    expect(
      classifyDeadline(
        {
          state: RunStates.FINALIZING,
          actionDeadline: '2026-07-21T01:10:00.000Z',
          absoluteDeadline: '2026-07-21T01:15:00.000Z',
        },
        {
          events: [
            {
              state: 'CLAIMING_IN_PROGRESS',
              timestamp: '2026-07-21T01:09:59.000Z',
            },
          ],
        },
        '2026-07-21T01:15:00.000Z',
      ),
    ).toEqual(RunStates.TIMED_OUT);
  });

  it('does not change a terminal run', () => {
    expect(
      classifyDeadline(
        {
          state: RunStates.PASSED,
          actionDeadline: '2026-07-21T01:10:00.000Z',
          absoluteDeadline: '2026-07-21T01:15:00.000Z',
        },
        null,
        '2026-07-22T01:00:00.000Z',
      ),
    ).toEqual(RunStates.PASSED);
  });
});
