/*
 * Copyright 2024 Velocity Team
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
 *
 */
const { ObjectId } = require('mongodb');
const {
  initObjectIdAutoboxExtension,
} = require('../src/object-id-autobox-extension');

describe('autobox field extension', () => {
  const mockParent = {
    prepModification: jest.fn().mockImplementation((arg) => arg),
    prepFilter: jest.fn().mockImplementation((arg) => arg),
    extensions: [],
  };

  describe('prepFilter', () => {
    it('should do nothing if prop is missing', () => {
      const filter = {
        foo: 'foo',
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('bar');
      expect(objectIdAutoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: 'foo',
      });
    });
    it('should do nothing if prop is not a string with an ObjectId pattern', () => {
      const filter = {
        foo: 'foo',
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('foo');
      expect(objectIdAutoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: 'foo',
      });
    });
    it('should change prop to ObjectId if prop is a string with an ObjectId pattern', () => {
      const objectId = new ObjectId();
      const s = `${objectId}`;
      const filter = {
        foo: s,
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('foo');
      expect(objectIdAutoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: objectId,
      });
    });
    it('should handle array of props', () => {
      const objectId = new ObjectId();
      const s = `${objectId}`;
      const filter = {
        foo: s,
        bar: s,
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension([
        'foo',
        'bar',
      ]);
      expect(objectIdAutoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: objectId,
        bar: objectId,
      });
    });
  });

  describe('prepModification', () => {
    it('should do nothing if prop is missing', () => {
      const val = {
        foo: 'foo',
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('bar');
      expect(
        objectIdAutoboxExtension(mockParent).prepModification(val)
      ).toEqual({
        foo: 'foo',
      });
    });
    it('should do nothing if prop is not a string with an ObjectId pattern', () => {
      const val = {
        foo: 'foo',
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('foo');
      expect(
        objectIdAutoboxExtension(mockParent).prepModification(val)
      ).toEqual({
        foo: 'foo',
      });
    });
    it('should change prop to ObjectId if prop is a string with an ObjectId pattern', () => {
      const objectId = new ObjectId();
      const s = `${objectId}`;
      const val = {
        foo: s,
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension('foo');
      expect(
        objectIdAutoboxExtension(mockParent).prepModification(val)
      ).toEqual({
        foo: objectId,
      });
    });
    it('should handle array of props', () => {
      const objectId = new ObjectId();
      const s = `${objectId}`;
      const val = {
        foo: s,
        bar: s,
      };
      const objectIdAutoboxExtension = initObjectIdAutoboxExtension([
        'foo',
        'bar',
      ]);
      expect(
        objectIdAutoboxExtension(mockParent).prepModification(val)
      ).toEqual({
        foo: objectId,
        bar: objectId,
      });
    });
  });
});
