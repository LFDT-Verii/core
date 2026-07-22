const { runEvidenceMongoEntity } = require('./entities/run-evidence');

/** @typedef {import('../../entities/run-evidence').RunEvidence} RunEvidence */

const interactionFields = Object.freeze({
  issue: 'issueInteraction',
  disclosure: 'disclosureInteraction',
});

/**
 * @param {import('mongodb').Db} db
 * @returns {import('../contracts').RunEvidenceRepository}
 */
const createRunEvidenceRepository = (db) => {
  /** @type {import('mongodb').Collection<RunEvidence>} */
  const collection = db.collection(runEvidenceMongoEntity.collectionName);
  const projection = runEvidenceMongoEntity.defaultProjection;
  const updateAndReturn = (runId, fields, updatedAt) =>
    collection
      .findOneAndUpdate(
        { runId },
        { $set: { ...fields, updatedAt } },
        { returnDocument: 'after', projection },
      )
      .then((evidence) => evidence ?? undefined);

  return {
    create: async (evidence) => {
      await collection.insertOne(evidence);
      return evidence;
    },
    findByRunId: (runId) =>
      collection
        .findOne({ runId }, { projection })
        .then((evidence) => evidence ?? undefined),
    saveInteraction: ({ runId, phase, interaction, updatedAt }) =>
      updateAndReturn(
        runId,
        { [interactionFields[phase]]: interaction },
        updatedAt,
      ),
    saveIssuedCredential: ({ runId, credential, updatedAt }) =>
      updateAndReturn(runId, { issuedCredential: credential }, updatedAt),
    saveTerminalEvidence: ({ runId, fields, updatedAt }) =>
      updateAndReturn(runId, fields, updatedAt),
  };
};

module.exports = { createRunEvidenceRepository };
