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

const {
  transformToDocumentSkip,
  transformToPageSize,
  transformToSortDocument,
  initTransformToFilterDocument,
  initTransformToFinder,
} = require('..');

describe('Search query transformation tests', () => {
  describe('finder transformation', () => {
    const defaultFinder = {
      filter: {},
      limit: 20,
      skip: 0,
      sort: [['_id', -1]],
    };
    it('should transform a no query', () => {
      expect(initTransformToFinder()()).toEqual(defaultFinder);
    });
    it('should transform a empty query', () => {
      expect(initTransformToFinder()({})).toEqual(defaultFinder);
    });
    it('should transform a null query', () => {
      expect(() => initTransformToFinder()(null)).toThrow(Error);
    });
    it('should transform an empty query', () => {
      expect(initTransformToFinder()({})).toEqual(defaultFinder);
    });
    it('should transform a query with nonsense', () => {
      expect(initTransformToFinder()({ weird: 1 })).toEqual(defaultFinder);
    });
    it('should transform a query with just filter', () => {
      expect(initTransformToFinder()({ filter: { x: 1 } })).toEqual({
        ...defaultFinder,
        filter: { x: 1 },
      });
    });
    it('should transform a query with only sorting', () => {
      expect(
        initTransformToFinder()({
          sort: [['x', 'DESC']],
        })
      ).toEqual({
        ...defaultFinder,
        sort: [
          ['x', -1],
          ['_id', -1],
        ],
      });
    });
    it('should transform a query with only paging', () => {
      expect(
        initTransformToFinder()({
          page: {
            size: 20,
            skip: 2,
          },
        })
      ).toEqual({ ...defaultFinder, skip: 40, limit: 20 });
    });
    it('should transform a standard query', () => {
      expect(
        initTransformToFinder()({
          filter: { x: 1 },
          sort: [['x', 'ASC']],
          page: {
            size: 20,
            skip: 2,
          },
        })
      ).toEqual({
        filter: { x: 1 },
        sort: [
          ['x', 1],
          ['_id', -1],
        ],
        skip: 40,
        limit: 20,
      });
    });
    it('should transform if there are overrides', () => {
      expect(
        initTransformToFinder(null, {
          transformToFilterDocument: ({ filter }) => ({
            filter: {
              y: filter.x + 1,
            },
          }),
        })({
          filter: { x: 1 },
          sort: [['x', 'ASC']],
          page: {
            size: 20,
            skip: 2,
          },
        })
      ).toEqual({
        filter: { y: 2 },
        sort: [
          ['x', 1],
          ['_id', -1],
        ],
        skip: 40,
        limit: 20,
      });
    });
    it('should transform if there are dates', () => {
      expect(
        initTransformToFinder()({
          filter: { fromDate: '2021-12-01' },
        })
      ).toEqual({
        ...defaultFinder,
        filter: { createdAt: { $gte: new Date('2021-12-01T00:00:00.000Z') } },
      });
    });
    it('should transform if there are dates with a particular repo', () => {
      expect(
        initTransformToFinder({
          collection: { timestampKeys: { createdAt: 'at' } },
        })({
          filter: { fromDate: '2021-12-01' },
        })
      ).toEqual({
        ...defaultFinder,
        filter: { at: { $gte: new Date('2021-12-01T00:00:00.000Z') } },
      });
    });
  });

  describe('Filter transformations', () => {
    it('should ignore keys that do not begin "filter." or equal "q"', () => {
      const query = {
        foo: 'bar',
      };
      const transformedQuery = initTransformToFilterDocument()(query);
      expect(transformedQuery).toEqual({});
    });

    it('should ignore "filter." key', () => {
      const query = {
        'filter.': 'bar',
      };
      const transformedQuery = initTransformToFilterDocument()(query);
      expect(transformedQuery).toEqual({});
    });

    it('should properly transform filter property into its own object', () => {
      const query = {
        filter: { foo: 'bar' },
      };
      const transformedQuery = initTransformToFilterDocument()(query);
      expect(transformedQuery).toEqual({
        foo: 'bar',
      });
    });

    it('should properly transform "q" query key to a profile.name regex query', () => {
      const query = {
        q: 'bar',
      };
      const transformedQuery = initTransformToFilterDocument()(query);
      expect(transformedQuery).toEqual({
        'profile.name': {
          $regex: new RegExp(query.q, 'igu'),
        },
      });
    });

    it('should transform to empty object if nextPageItem and prevPageItem exists', () => {
      const transformToFilterDocument = initTransformToFilterDocument();
      const transformedQuery = transformToFilterDocument({
        filter: { nextPageToken: 'bar', prevPageToken: 'bar' },
      });
      expect(transformedQuery).toEqual({});
    });
  });

  describe('Sort transformations', () => {
    it('should have a default ["_id", -1] sort query', () => {
      const query = {};
      const transformedQuery = transformToSortDocument(query);
      expect(transformedQuery).toHaveLength(1);
      expect(transformedQuery[0]).toHaveLength(2);
      expect(transformedQuery).toEqual([['_id', -1]]);
    });

    it('should handle a malformed sort query', () => {
      const query = {
        sort: '[',
      };
      let err;
      try {
        transformToSortDocument(query);
      } catch (e) {
        err = e;
      }
      expect(err.name).toEqual('Error');
      expect(err.message).toEqual('Invalid sort direction: undefined');
    });

    it('should properly transform a sort query', () => {
      const query = {
        sort: [['createdAt', 'DESC']],
      };
      const transformedQuery = transformToSortDocument(query);
      expect(transformedQuery).toHaveLength(2);
      expect(transformedQuery[0]).toHaveLength(2);
      expect(transformedQuery[1]).toHaveLength(2);
      expect(transformedQuery).toEqual([
        ['createdAt', -1],
        ['_id', -1],
      ]);
    });
  });

  describe('Page Size transformations', () => {
    it('should ignore keys that do not equal "page.size"', () => {
      const query = {
        foo: 'bar',
      };
      const pageSizeNumber = transformToPageSize(query);
      expect(pageSizeNumber).toEqual(20);
    });

    it('should ignore "page." key', () => {
      const query = {
        'page.': '2',
      };
      const pageSizeNumber = transformToPageSize(query);
      expect(pageSizeNumber).toEqual(20);
    });

    it('should ignore other "page.*" keys', () => {
      const query = {
        page: {
          foo: 2,
        },
      };
      const pageSizeNumber = transformToPageSize(query);
      expect(pageSizeNumber).toEqual(20);
    });

    it('should properly handle non-Number-castable "page.size" values into NaN', () => {
      const query = {
        page: {
          size: 'foo',
        },
      };
      const pageSizeNumber = transformToPageSize(query);
      expect(pageSizeNumber).toEqual(20);
    });

    it('should properly parse "page.size" key into a Number', () => {
      const query = {
        page: {
          size: 2,
        },
      };
      const pageSizeNumber = transformToPageSize(query);
      expect(pageSizeNumber).toEqual(2);
    });
  });

  describe('Page Skip transformations', () => {
    it('should ignore keys that do not equal "page.skip"', () => {
      const query = {
        foo: 'bar',
      };
      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });

    it('should ignore "page." key', () => {
      const query = {
        'page.': '2',
      };
      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });

    it('should ignore other "page.*" keys', () => {
      const query = {
        page: { foo: 2 },
      };
      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });

    it('should properly handle non-Number-castable "page.skip" values into NaN', () => {
      const query = {
        page: {
          skip: 'foo',
        },
      };

      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });

    it('should properly parse "page.skip" and "page.size" key into Numbers', () => {
      const query = {
        page: {
          skip: 2,
          size: 4,
        },
      };

      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(8);
    });

    it('should properly transform to "skip" property nextPageItem or prevPageItem', () => {
      const transformedQuery1 = transformToDocumentSkip({
        page: { nextPageToken: 5 },
      });
      const transformedQuery2 = transformToDocumentSkip({
        page: { prevPageToken: 5 },
      });
      const transformedQuery3 = transformToDocumentSkip({
        page: { prevPageToken: '', nextPageToken: '' },
      });
      expect(transformedQuery1).toEqual(5);
      expect(transformedQuery2).toEqual(5);
      expect(transformedQuery3).toEqual(0);
    });

    it('should use defaults to compute skip if size is not a number', () => {
      const query = {
        page: {
          skip: 2,
          size: null,
        },
      };

      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });

    it('should use defaults to compute skip if skip is not a number', () => {
      const query = {
        page: {
          skip: null,
          size: 3,
        },
      };

      const pageSkipNumber = transformToDocumentSkip(query);
      expect(pageSkipNumber).toEqual(0);
    });
  });

  describe('Date transformations', () => {
    it('should transform a from date', () => {
      expect(
        initTransformToFilterDocument()({ filter: { fromDate: '2021-12-01' } })
      ).toEqual({ createdAt: { $gte: new Date('2021-12-01T00:00:00.000Z') } });
    });
    it('should transform a to date', () => {
      expect(
        initTransformToFilterDocument()({ filter: { toDate: '2021-12-01' } })
      ).toEqual({ createdAt: { $lte: new Date('2021-12-01T23:59:59.999Z') } });
    });
    it('should transform a both dates', () => {
      expect(
        initTransformToFilterDocument()({
          filter: { toDate: '2021-12-01', fromDate: '2021-12-01' },
        })
      ).toEqual({
        createdAt: {
          $gte: new Date('2021-12-01T00:00:00.000Z'),
          $lte: new Date('2021-12-01T23:59:59.999Z'),
        },
      });
    });
    it('should transform a dates with non standard names', () => {
      expect(
        initTransformToFilterDocument({ timestampKeys: { createdAt: 'at' } })({
          filter: { toDate: '2021-12-01', fromDate: '2021-12-01' },
        })
      ).toEqual({
        at: {
          $gte: new Date('2021-12-01T00:00:00.000Z'),
          $lte: new Date('2021-12-01T23:59:59.999Z'),
        },
      });
    });
    it('should transform a dates across a few days', () => {
      expect(
        initTransformToFilterDocument()({
          filter: { toDate: '2021-12-31', fromDate: '2021-12-01' },
        })
      ).toEqual({
        createdAt: {
          $gte: new Date('2021-12-01T00:00:00.000Z'),
          $lte: new Date('2021-12-31T23:59:59.999Z'),
        },
      });
    });
  });
});
