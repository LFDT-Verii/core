const { runEvidenceEntity } = require('../../../entities/run-evidence');

const runEvidenceMongoEntity = Object.freeze({
  ...runEvidenceEntity,
  collectionName: 'runEvidence',
  defaultProjection: Object.freeze({ _id: 0 }),
  indexes: Object.freeze([
    { key: { runId: 1 }, name: 'runId_unique', unique: true },
    { key: { purgeAt: 1 }, name: 'evidence_ttl', expireAfterSeconds: 0 },
  ]),
});

module.exports = { runEvidenceMongoEntity };
