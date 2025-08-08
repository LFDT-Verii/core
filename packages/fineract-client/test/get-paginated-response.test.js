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
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { getPaginatedResponse } = require('../src/get-paginated-response');

describe('Get paginated response test suite', () => {
  it('should generate next prev page tokens', async () => {
    const result = getPaginatedResponse({
      pageNumber: 2,
      pageSize: 10,
      totalFilteredRecords: 100,
    });
    expect(result).toEqual({
      nextPageToken: 3,
      prevPageToken: 1,
    });
  });
  it('should get paginated response with no next page token', async () => {
    const result = getPaginatedResponse({
      pageNumber: 10,
      pageSize: 10,
      totalFilteredRecords: 100,
    });
    expect(result).toEqual({
      nextPageToken: '',
      prevPageToken: 9,
    });
  });
  it('should get paginated response with no prev page token', async () => {
    const result = getPaginatedResponse({
      pageNumber: 1,
      pageSize: 10,
      totalFilteredRecords: 100,
    });
    expect(result).toEqual({
      nextPageToken: 2,
      prevPageToken: '',
    });
  });
  it('should get paginated response with last page', async () => {
    const result = getPaginatedResponse({
      pageNumber: 1,
      pageSize: 30,
      totalFilteredRecords: 31,
    });
    expect(result).toEqual({
      nextPageToken: 2,
      prevPageToken: '',
    });
  });
  it('should get paginated response with no page tokens', async () => {
    const result = getPaginatedResponse({
      pageNumber: 0,
      pageSize: 10,
      totalFilteredRecords: 10,
    });
    expect(result).toEqual({
      nextPageToken: '',
      prevPageToken: '',
    });
  });
  it('should get paginated response with no page tokens if page number is not number', async () => {
    const result = getPaginatedResponse({
      pageNumber: undefined,
      pageSize: undefined,
      totalFilteredRecords: undefined,
    });
    expect(result).toEqual({
      nextPageToken: '',
      prevPageToken: '',
    });
  });
});
