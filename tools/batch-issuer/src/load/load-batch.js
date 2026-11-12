/**
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global AggregateError */

const {
  chunk,
  filter,
  flatMap,
  flatten,
  flow,
  get,
  has,
  isArray,
  join,
  keyBy,
  map,
  mapValues,
  pick,
  reject,
  size,
  uniqBy,
  zipWith,
} = require('lodash/fp');
const { runSequentially } = require('@verii/common-functions');
const {
  CREDENTIALS_CREATE_MANY_MAX_ITEMS,
} = require('@verii/credentialing-hub-operator-api');
const { isInternalVpAuth, isPreauth } = require('../validation/check-service');
const { appendRecords, startState } = require('../state/state-file');
const { count } = require('../report/count');

// The status of a wallet message that the Hub couldn't send.
const FAILED_NOTIFICATION = 'failed';

const addToList = (state, key, records) => ({
  ...state,
  [key]: [...state[key], ...records],
});

// Runs a step for each item, one at a time. The records that a step gives
// are appended to the state file as soon as it ends, and the records of
// every step are added to one of the state's lists.
const inSequence = (append, key, step) => async (state, items) => {
  const recordStep = async (item) => append(key, await step(item));
  const records = await runSequentially(
    map((item) => () => recordStep(item), items),
  );
  return addToList(state, key, flatten(records));
};

// Each row's depot id, by row: the existing depot that validation matched it
// to, or else the depot that this batch created for it, in this run or an
// earlier one.
const depotIdsByRow = (rows, state) => ({
  ...flow(keyBy('row'), mapValues('id'))(state.depots),
  ...flow(
    filter('existingDepot'),
    keyBy('row'),
    mapValues(get(['existingDepot', 'id'])),
  )(rows),
});

// Rows whose depot exists, and wasn't created by this batch.
const reusedRows = (rows, state) => {
  const createdIds = new Set(map('id', state.depots));
  const isReused = ({ existingDepot }) =>
    existingDepot != null && !createdIds.has(existingDepot.id);
  return filter(isReused, rows);
};

const rowsWithoutDepots = (rows, state) => {
  const depotIds = depotIdsByRow(rows, state);
  return reject(({ row }) => has([row], depotIds), rows);
};

// A 409 means that another client created a depot with the row's auth values
// after validation.
const refuseDepot = (spec, row) => (error) => {
  if (error.statusCode !== 409) {
    throw error;
  }
  const rowError = {
    row: row.row,
    column: join(', ', map('column', spec.depot.authValues)),
    reason: `the auth values belong to depot ${get(['body', 'depotId'], error)}, which another client created after validation`,
  };
  throw new AggregateError([rowError], 'depots/create refused a depot');
};

const createDepots = ({ spec, hub, append }) =>
  inSequence(append, 'depots', async (row) => {
    const depot = await hub
      .createDepot(spec, row.depot)
      .catch(refuseDepot(spec, row));
    return [{ row: row.row, id: depot.id }];
  });

const toItems =
  (depotIds) =>
  ({ row, credentials }) =>
    map(
      ({ template, credential }) => ({
        row,
        template,
        depotId: get([row], depotIds),
        credential,
      }),
      credentials,
    );

// The credentials that no run of this batch has created yet, each with its
// row's depot, in requests of at most the items create-many takes.
const pendingRequests = (rows, state) => {
  const depotIds = depotIdsByRow(rows, state);
  const createdReferences = new Set(
    map('credentialReference', state.credentials),
  );
  const isCreated = ({ credential }) =>
    createdReferences.has(credential.credentialReference);
  return flow(
    flatMap(toItems(depotIds)),
    reject(isCreated),
    chunk(CREDENTIALS_CREATE_MANY_MAX_ITEMS),
  )(rows);
};

// A 400 lists each invalid item by its index in the request. The Hub checks
// every item before it creates any, so it created none of them.
const refuseItems = (items) => (error) => {
  const itemErrors = get(['body', 'errors'], error);
  if (error.statusCode !== 400 || !isArray(itemErrors)) {
    throw error;
  }
  const toRowError = ({ index, message }) => ({
    ...pick(['row', 'template'], get([index], items)),
    reason: message,
  });
  const refused = count(size(uniqBy('index', itemErrors)), 'credential');
  throw new AggregateError(
    map(toRowError, itemErrors),
    `credentials/create-many refused ${refused}, so it created none of the ${count(size(items), 'credential')} in its request`,
  );
};

const toCredentialRecord = ({ row, depotId, credential }, { id }) => ({
  row,
  credentialReference: credential.credentialReference,
  id,
  depotId,
});

const createCredentials = ({ spec, hub, append }) =>
  inSequence(append, 'credentials', async (items) => {
    const credentials = await hub
      .createCredentials(spec, map(pick(['depotId', 'credential']), items))
      .catch(refuseItems(items));
    return zipWith(toCredentialRecord, items, credentials);
  });

// Reused depots that defer credentials and received some from this batch, in
// this run or an earlier one, and that no run has resolved yet, with their
// rows.
const depotsToResolve = (rows, state) => {
  const receivingIds = new Set(map('depotId', state.credentials));
  const resolvedIds = new Set(state.resolvedDepots);
  const isWaiting = ({ existingDepot: { id, deferredCredentials } }) =>
    deferredCredentials === true &&
    receivingIds.has(id) &&
    !resolvedIds.has(id);
  return flow(
    filter(isWaiting),
    map(({ row, existingDepot }) => ({ row, id: existingDepot.id })),
  )(reusedRows(rows, state));
};

// Resolves each depot, one at a time. A depot whose wallet message failed
// isn't recorded as resolved, so that a rerun resolves it again.
const resolveDepots =
  ({ spec, hub, append }) =>
  async (state, depots) => {
    const resolveDepot = async ({ row, id }) => {
      const { status, error } = await hub.resolveDeferredCredentials(spec, id);
      return status === FAILED_NOTIFICATION
        ? { resolved: [], failed: [{ row, depotId: id, error }] }
        : { resolved: await append('resolvedDepots', [id]), failed: [] };
    };
    const results = await runSequentially(
      map((depot) => () => resolveDepot(depot), depots),
    );
    return {
      state: addToList(state, 'resolvedDepots', flatMap('resolved', results)),
      failedNotifications: flatMap('failed', results),
    };
  };

// The depots this batch created that have no link yet. Reused depots are
// never refreshed: a refresh replaces the depot's pre-authorized code, which
// breaks the links already sent.
const depotsToLink = (state) => {
  const linkedRows = new Set(map('row', state.links));
  return reject(({ row }) => linkedRows.has(row), state.depots);
};

const linkDepots = ({ spec, hub, append }) =>
  inSequence(append, 'links', async ({ row, id }) => {
    const redirectUrl = await hub.refreshIssueLink(spec, id);
    return [{ row, redirectUrl }];
  });

/**
 * Loads a valid batch into the Hub, as the README's Loading section
 * describes. The state file records each depot, credential, resolved depot
 * and link as soon as the Hub confirms it, and what it records is skipped.
 * @param {{ spec: object, service: object, rows: Array<object> }} batch the validated batch
 * @param {{ hub: object, state: object, saved?: object, stateFile: string, resolveDeferred?: boolean }} context
 *   saved is what readState read from the state file, if it was there
 * @returns {Promise<{ state: object, sharedLink?: string, failedNotifications: Array<object> }>} the final
 *   state, the service's shared link when it uses verifiable_presentation auth, and the depots whose
 *   wallet message failed when their deferred credentials were resolved, with their rows and the Hub's error
 * @throws an AggregateError of row errors when the Hub refuses a depot or credentials, or the error of a
 *   request that failed. The state file then holds what was created before it
 */
const loadBatch = async (
  { spec, service, rows },
  { hub, state, saved, stateFile, resolveDeferred },
) => {
  const context = { spec, hub, append: appendRecords(stateFile) };
  await startState(stateFile, saved, state.batch);
  const withDepots = await createDepots(context)(
    state,
    rowsWithoutDepots(rows, state),
  );
  const withCredentials = await createCredentials(context)(
    withDepots,
    pendingRequests(rows, withDepots),
  );
  const resolution = await resolveDepots(context)(
    withCredentials,
    resolveDeferred ? depotsToResolve(rows, withCredentials) : [],
  );
  const final = await linkDepots(context)(
    resolution.state,
    isPreauth(service) ? depotsToLink(resolution.state) : [],
  );
  const sharedLink = isInternalVpAuth(service)
    ? await hub.refreshIssueLink(spec)
    : undefined;
  return {
    state: final,
    sharedLink,
    failedNotifications: resolution.failedNotifications,
  };
};

/**
 * Counts what a load did, from the state before it and after it.
 * @param {Array<object>} rows the batch's rows
 * @param {object} initial the state before the load
 * @param {object} final the state after it, or when it stopped
 * @param {{ resolveDeferred?: boolean }} options
 * @returns {{ depots: object, credentials: object, resolvedDepots?: number }} what this run created, reused
 *   and resolved, and what it skipped because an earlier run created it
 */
const summarizeLoad = (rows, initial, final, { resolveDeferred }) => {
  const created = (key) => size(final[key]) - size(initial[key]);
  return {
    depots: {
      created: created('depots'),
      reused: size(reusedRows(rows, initial)),
      skipped: size(initial.depots),
    },
    credentials: {
      created: created('credentials'),
      skipped: size(initial.credentials),
    },
    ...(resolveDeferred ? { resolvedDepots: created('resolvedDepots') } : {}),
  };
};

/**
 * Lists each row's link: its own, from the depot this batch created for it,
 * or else the service's shared link. Rows without either are left out.
 * @param {Array<object>} rows the batch's rows
 * @param {object} state the final state
 * @param {string} [sharedLink] the service's shared link
 * @returns {Array<{ row: number, userReference: string, redirectUrl: string }>}
 */
const listLinks = (rows, state, sharedLink) => {
  const linksByRow = flow(keyBy('row'), mapValues('redirectUrl'))(state.links);
  const toLink = ({ row, depot }) => ({
    row,
    userReference: depot.userReference,
    redirectUrl: get([row], linksByRow) ?? sharedLink,
  });
  return flow(map(toLink), filter('redirectUrl'))(rows);
};

module.exports = { listLinks, loadBatch, summarizeLoad };
