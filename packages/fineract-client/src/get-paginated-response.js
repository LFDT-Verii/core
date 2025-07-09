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

const getPaginatedResponse = ({
  pageNumber,
  pageSize,
  totalFilteredRecords,
}) => {
  let nextPageToken = '';
  let prevPageToken = '';

  if (!pageNumber || !pageSize || !totalFilteredRecords) {
    return {
      nextPageToken,
      prevPageToken,
    };
  }

  const page = Number(pageNumber);
  const size = Number(pageSize);
  const total = Number(totalFilteredRecords);

  const totalPages = Math.ceil(total / size);

  if (page < totalPages) {
    nextPageToken = page + 1;
  }

  if (page > 1) {
    prevPageToken = page - 1;
  }

  return {
    nextPageToken,
    prevPageToken,
  };
};

module.exports = {
  getPaginatedResponse,
};
