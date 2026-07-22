const { certificationRunsEntity } = require('./entities/certification-runs');

/** @typedef {import('../../entities/certification-run').CertificationRun} CertificationRun */

/**
 * @param {import('mongodb').Db} db
 * @returns {import('../contracts').CertificationRunsRepository}
 */
const createCertificationRunsRepository = (db) => {
  /** @type {import('mongodb').Collection<CertificationRun>} */
  const collection = db.collection(certificationRunsEntity.collectionName);
  const projection = certificationRunsEntity.defaultProjection;

  const findByRunId = (runId) =>
    collection
      .findOne({ runId }, { projection })
      .then((run) => run ?? undefined);

  return {
    create: async (run) => {
      await collection.insertOne(run);
      return run;
    },
    removeByRunId: async (runId) =>
      (await collection.deleteOne({ runId })).deletedCount === 1,
    findByRunId,
    setHubResources: ({ runId, fields, updatedAt }) =>
      collection
        .findOneAndUpdate(
          { runId },
          { $set: { ...fields, updatedAt }, $inc: { revision: 1 } },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    startInteraction: ({
      runId,
      expectedState,
      state,
      interactionPhase,
      actionDeadline,
      absoluteDeadline,
      nextCheckAt,
      updatedAt,
    }) =>
      collection
        .findOneAndUpdate(
          { runId, ...(expectedState ? { state: expectedState } : {}) },
          {
            $set: {
              state,
              interactionPhase,
              actionDeadline,
              absoluteDeadline,
              nextCheckAt,
              updatedAt,
            },
            $inc: { revision: 1 },
            $push: { journal: { state, at: updatedAt } },
          },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    acquireLease: ({ runId, state, now, leaseUntil }) =>
      collection
        .findOneAndUpdate(
          {
            runId,
            state,
            nextCheckAt: { $lte: now },
            $or: [
              { leaseUntil: { $exists: false } },
              { leaseUntil: null },
              { leaseUntil: { $lte: now } },
            ],
          },
          { $set: { leaseUntil, updatedAt: now } },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    schedule: ({ runId, expectedState, state, nextCheckAt, updatedAt }) => {
      const stateChanged = expectedState !== state;
      return collection
        .findOneAndUpdate(
          { runId, state: expectedState },
          {
            $set: { state, nextCheckAt, leaseUntil: null, updatedAt },
            $inc: { revision: 1 },
            ...(stateChanged
              ? { $push: { journal: { state, at: updatedAt } } }
              : {}),
          },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined);
    },
    recordReconcileFailure: ({
      runId,
      expectedState,
      nextCheckAt,
      updatedAt,
    }) =>
      collection
        .findOneAndUpdate(
          { runId, state: expectedState },
          {
            $set: {
              lastReconcileErrorCode: 'hub_unavailable',
              nextCheckAt,
              leaseUntil: null,
              updatedAt,
            },
            $inc: { reconcileFailures: 1, revision: 1 },
          },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    prepareDisclosure: ({
      runId,
      expectedState,
      setupCredentialFingerprint,
      updatedAt,
    }) =>
      collection
        .findOneAndUpdate(
          { runId, state: expectedState },
          {
            $set: {
              state: 'PREPARING_DISCLOSURE',
              setupCredentialFingerprint,
              leaseUntil: null,
              updatedAt,
            },
            $inc: { revision: 1 },
            $push: {
              journal: { state: 'PREPARING_DISCLOSURE', at: updatedAt },
            },
            $unset: {
              actionDeadline: '',
              absoluteDeadline: '',
              nextCheckAt: '',
            },
          },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    complete: ({ runId, expectedState, state, fields, completedAt }) =>
      collection
        .findOneAndUpdate(
          { runId, state: expectedState },
          {
            $set: fields,
            $inc: { revision: 1 },
            $push: { journal: { state, at: completedAt } },
            $unset: { nextCheckAt: '' },
          },
          { returnDocument: 'after', projection },
        )
        .then((run) => run ?? undefined),
    findDue: ({ now, terminalStates, limit }) =>
      collection
        .find(
          {
            state: { $nin: terminalStates },
            nextCheckAt: { $lte: now },
            $or: [
              { leaseUntil: { $exists: false } },
              { leaseUntil: null },
              { leaseUntil: { $lte: now } },
            ],
          },
          { projection, sort: { nextCheckAt: 1 }, limit },
        )
        .toArray(),
  };
};

module.exports = { createCertificationRunsRepository };
