/**
 * Copyright 2023 Velocity Team
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

const { flow, reduce, omit, set, isNumber } = require('lodash/fp');

const initTransformToFinder = (targetRepo, overrides) => {
  const baseTransformToFilterDocument = initTransformToFilterDocument(
    targetRepo?.collection
  );
  const transformToFilterDocument = overrides?.transformToFilterDocument
    ? flow(overrides.transformToFilterDocument, baseTransformToFilterDocument)
    : baseTransformToFilterDocument;

  const transformToFinder = (source) => ({
    filter: transformToFilterDocument(source),
    sort: transformToSortDocument(source),
    limit: transformToPageSize(source),
    skip: transformToDocumentSkip(source),
  });

  return transformToFinder;
};

const convertDate = (suffix) =>
  flow(
    (date) => `${date}${suffix}`,
    (timestamp) => new Date(timestamp)
  );

const toStartOfDay = convertDate('T00:00:00.000Z');
const toEndOfDay = convertDate('T23:59:59.999Z');

const initTransformToFilterDocument =
  (targetCollection = { timestampKeys: { createdAt: 'createdAt' } }) =>
  ({ filter, q } = {}) => {
    let baseMongoFilterObj;
    baseMongoFilterObj = {};

    if (filter) {
      baseMongoFilterObj = omit(
        ['q', 'fromDate', 'toDate', 'prevPageToken', 'nextPageToken'],
        filter
      );
    }

    return {
      ...baseMongoFilterObj,
      ...buildDateRangeFilter({ filter, targetCollection }),
      ...buildProfileNameFilter(q),
    };
  };

const buildProfileNameFilter = (q) => {
  if (q) {
    return {
      'profile.name': { $regex: new RegExp(q, 'igu') },
    };
  }
  return {};
};

const buildDateRangeFilter = ({ filter, targetCollection }) => {
  let mongoFilterObj = {};
  if (filter?.fromDate) {
    mongoFilterObj = set(
      `${targetCollection.timestampKeys.createdAt}.$gte`,
      toStartOfDay(filter.fromDate),
      mongoFilterObj
    );
  }
  if (filter?.toDate) {
    mongoFilterObj = set(
      `${targetCollection.timestampKeys.createdAt}.$lte`,
      toEndOfDay(filter.toDate),
      mongoFilterObj
    );
  }
  return mongoFilterObj;
};

const transformToSortDocument = ({ sort } = {}) => {
  const defaultMongoSortTuple = ['_id', -1];
  const mongoSortObj = reduce(
    (sortArr, currentTupleArr) => {
      return [
        ...sortArr,
        transformSortTupleArrayToMongoSortObject(currentTupleArr),
      ];
    },
    [],
    sort
  );
  return [...mongoSortObj, defaultMongoSortTuple];
};

const transformToPageSize = ({ page } = {}) => {
  if (!isNumber(page?.size)) {
    return DEFAULT_SIZE;
  }
  return page.size;
};

const transformToDocumentSkip = ({ page } = {}) => {
  if (page?.nextPageToken || page?.prevPageToken) {
    return Number(page?.nextPageToken) || Number(page?.prevPageToken);
  }
  if (isNumber(page?.skip) && isNumber(page?.size)) {
    return page.skip * page.size;
  }
  return 0;
};

const transformSortTupleArrayToMongoSortObject = (tupleArr) => {
  const [key, direction] = tupleArr;
  if (validateSortDirection(direction)) {
    return [key, direction === SORT_DESC ? -1 : 1];
  }
  throw new Error(`Invalid sort direction: ${direction}`);
};

const SORT_ASC = 'ASC';
const SORT_DESC = 'DESC';
const DEFAULT_SKIP = 0;
const DEFAULT_SIZE = 20;

const validateSortDirection = (direction) =>
  direction === SORT_ASC || direction === SORT_DESC;

module.exports = {
  initTransformToFilterDocument,
  transformToSortDocument,
  transformToPageSize,
  transformToDocumentSkip,
  initTransformToFinder,
  toStartOfDay,
  toEndOfDay,
  transformSortTupleArrayToMongoSortObject,
  validateSortDirection,
  DEFAULT_SKIP,
  DEFAULT_SIZE,
  SORT_ASC,
  SORT_DESC,
};
