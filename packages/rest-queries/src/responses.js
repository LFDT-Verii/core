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

const { size, take, get, isEmpty } = require('lodash/fp');

const getItemsForCurrentPage = ({ data, pageSize }) => {
  return take(pageSize, data);
};
const getNextPageToken = ({ data, pageSize, nextPageToken, prevPageToken }) => {
  if (size(data) <= pageSize) {
    return '';
  }
  if (!nextPageToken && !prevPageToken) {
    return pageSize;
  }
  const newPageToken = nextPageToken
    ? (nextPageToken || 0) + pageSize
    : prevPageToken + pageSize;
  return newPageToken;
};
const getPrevPageToken = ({ nextPageToken, prevPageToken, pageSize }) => {
  if (!nextPageToken && !prevPageToken) {
    return '';
  }
  const newPageToken = nextPageToken
    ? nextPageToken - pageSize
    : prevPageToken - pageSize;
  return newPageToken < pageSize ? '' : newPageToken;
};
const buildPaginatedResponse = ({ fieldName, data = [] }, context) => {
  const nextPageToken = Number(get('body.page.nextPageToken', context));
  const prevPageToken = Number(get('body.page.prevPageToken', context));
  const pageSize = Number(get('body.page.size', context));
  if (isEmpty(get('body.page', context)) || !size(data)) {
    return {
      [fieldName]: data,
      requestId: context.id,
      nextPageToken: '',
      prevPageToken: '',
    };
  }
  return {
    [fieldName]: getItemsForCurrentPage({
      data,
      pageSize,
    }),
    requestId: context.id,
    nextPageToken: getNextPageToken({
      data,
      pageSize,
      nextPageToken,
      prevPageToken,
    }),
    prevPageToken: getPrevPageToken({
      pageSize,
      nextPageToken,
      prevPageToken,
    }),
  };
};

module.exports = {
  buildPaginatedResponse,
};
