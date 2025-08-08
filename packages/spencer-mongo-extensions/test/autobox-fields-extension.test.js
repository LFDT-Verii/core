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
const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockParent = {
  prepModification: mock.fn((arg) => arg),
  prepFilter: mock.fn((arg) => arg),
  extensions: [],
};

const testAutoboxFunc = mock.fn((val) => String(val));

const {
  initAutoboxFieldsExtension,
} = require('../src/autobox-fields-extension');

describe('autobox field extension', () => {
  beforeEach(() => {
    testAutoboxFunc.mock.resetCalls();
  });

  describe('prepFilter', () => {
    it('should not call autoboxing function if prop is missing', () => {
      const filter = {
        foo: 1,
      };
      const autoboxExtension = initAutoboxFieldsExtension(
        'bar',
        testAutoboxFunc
      );
      expect(autoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: 1,
      });
      expect(testAutoboxFunc.mock.calls.map((call) => call.arguments)).toEqual(
        []
      );
    });
    it('should call autoboxing function for every prop that is present', () => {
      const filter = {
        foo: 1,
        bar: false,
        foo2: null,
      };
      const autoboxExtension = initAutoboxFieldsExtension(
        ['foo', 'bar'],
        testAutoboxFunc
      );
      expect(autoboxExtension(mockParent).prepFilter(filter)).toEqual({
        foo: '1',
        bar: 'false',
        foo2: null,
      });
      expect(testAutoboxFunc.mock.calls.map((call) => call.arguments)).toEqual([
        [1],
        [false],
      ]);
    });
  });

  describe('prepModification', () => {
    it('should not call autoboxing function if prop is missing', () => {
      const modification = {
        foo: 1,
      };
      const autoboxExtension = initAutoboxFieldsExtension(
        'bar',
        testAutoboxFunc
      );
      expect(
        autoboxExtension(mockParent).prepModification(modification)
      ).toEqual({
        foo: 1,
      });
      expect(testAutoboxFunc.mock.calls.map((call) => call.arguments)).toEqual(
        []
      );
    });
    it('should call autoboxing function for every prop that is present', () => {
      const modification = {
        foo: 1,
        bar: false,
        foo2: null,
      };
      const autoboxExtension = initAutoboxFieldsExtension(
        ['foo', 'bar'],
        testAutoboxFunc
      );
      expect(
        autoboxExtension(mockParent).prepModification(modification)
      ).toEqual({
        foo: '1',
        bar: 'false',
        foo2: null,
      });
      expect(testAutoboxFunc.mock.calls.map((call) => call.arguments)).toEqual([
        [1],
        [false],
      ]);
    });
  });
});
