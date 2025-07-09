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

const { buildPaginatedResponse } = require('..');

describe('Responses test suite', () => {
  describe('BuildPaginatedResponse test suite', () => {
    it('should return a paginated response with the correct structure for middle page', () => {
      const data = [
        {
          _id: '1',
        },
        {
          _id: '2',
        },
        {
          _id: '3',
        },
      ];
      const context = {
        id: '5e5e1d5b5d9b9c0d8c0e5d81',
        body: {
          page: {
            size: 2,
            nextPageToken: '6',
          },
        },
      };
      const fieldName = 'test';
      const result = buildPaginatedResponse(
        {
          fieldName,
          data,
        },
        context
      );
      expect(result).toEqual({
        test: [data[0], data[1]],
        requestId: context.id,
        nextPageToken: 8,
        prevPageToken: 4,
      });
    });
    it('should return a paginated response with the correct structure when data is empty', () => {
      const data = [];
      const context = {
        id: '5e5e1d5b5d9b9c0d8c0e5d81',
        body: {
          page: {
            size: 2,
          },
        },
      };
      const fieldName = 'test';
      const result = buildPaginatedResponse(
        {
          fieldName,
          data,
        },
        context
      );
      expect(result).toEqual({
        test: [],
        requestId: context.id,
        nextPageToken: '',
        prevPageToken: '',
      });
    });
    it('should return a paginated response with the correct structure when prevPageToken <= 0', () => {
      const data = [
        {
          _id: '1',
        },
        {
          _id: '2',
        },
        {
          _id: '3',
        },
      ];
      const context = {
        id: '5e5e1d5b5d9b9c0d8c0e5d81',
        body: {
          page: {
            size: 2,
            nextPageToken: 2,
          },
        },
      };
      const fieldName = 'test';
      const result = buildPaginatedResponse(
        {
          fieldName,
          data,
        },
        context
      );
      expect(result).toEqual({
        test: [data[0], data[1]],
        requestId: context.id,
        nextPageToken: 4,
        prevPageToken: '',
      });
    });
    it('should return a paginated response with has next', () => {
      const data = [
        {
          _id: '1',
        },
        {
          _id: '2',
        },
        {
          _id: '3',
        },
      ];
      const context = {
        id: '5e5e1d5b5d9b9c0d8c0e5d81',
        body: {
          page: {
            size: 2,
          },
        },
      };
      const fieldName = 'test';
      const result = buildPaginatedResponse(
        {
          fieldName,
          data,
        },
        context
      );
      expect(result).toEqual({
        test: [data[0], data[1]],
        requestId: context.id,
        nextPageToken: 2,
        prevPageToken: '',
      });
    });
    it('should return a paginated response with has prev', () => {
      const data = [
        {
          _id: '1',
        },
      ];
      const context = {
        id: '5e5e1d5b5d9b9c0d8c0e5d81',
        body: {
          page: {
            size: 2,
            nextPageToken: '4',
          },
        },
      };
      const fieldName = 'test';
      const result = buildPaginatedResponse(
        {
          fieldName,
          data,
        },
        context
      );
      expect(result).toEqual({
        test: data,
        requestId: context.id,
        nextPageToken: '',
        prevPageToken: 2,
      });
    });
  });
});
