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

const { transformToPagination } = require('../src/transform-to-pagination');

describe('Transform to pagination test suite', () => {
  it('should transform to pagination with no page tokens', () => {
    const result = transformToPagination({
      size: 10,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 1,
    });
  });
  it('should transform to pagination with nextPageToken', () => {
    const result = transformToPagination({
      size: 10,
      nextPageToken: 2,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 2,
    });
  });
  it('should transform to pagination with prevPageToken', () => {
    const result = transformToPagination({
      size: 10,
      prevPageToken: 5,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 5,
    });
  });
  it('should transform to pagination with prevPageToken and nextPageToken', () => {
    const result = transformToPagination({
      size: 10,
      prevPageToken: 3,
      nextPageToken: 6,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 3,
    });
  });
  it('should transform to pagination if nextPageToken is negative', () => {
    const result = transformToPagination({
      size: 10,
      nextPageToken: -6,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 1,
    });
  });
  it('should transform to pagination if prevPageToken is negative', () => {
    const result = transformToPagination({
      size: 10,
      prevPageToken: -6,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 1,
    });
  });
  it('should set to default 0 pageNumber if next and prev not exist', () => {
    const result = transformToPagination({
      size: 10,
    });
    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 1,
    });
  });
});
