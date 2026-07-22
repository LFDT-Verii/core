const {
  certificationRunEntity,
} = require('../../../entities/certification-run');

const certificationRunsEntity = Object.freeze({
  ...certificationRunEntity,
  collectionName: 'certificationRuns',
  defaultProjection: Object.freeze({ _id: 0 }),
  indexes: Object.freeze([
    { key: { runId: 1 }, name: 'runId_unique', unique: true },
    {
      key: { state: 1, nextCheckAt: 1, leaseUntil: 1 },
      name: 'active_runs_due',
    },
    { key: { purgeAt: 1 }, name: 'runs_ttl', expireAfterSeconds: 0 },
  ]),
});

module.exports = { certificationRunsEntity };
