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
const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  validatePresentationContext,
} = require('../src/validate-presentation-context');

const config = {
  enablePresentationContextValidation: true,
  presentationContextValue: 'http://example.com/presentation.jsonld',
};

describe('validate presentation context', () => {
  it('disable presentation context validation', () => {
    expect(
      validatePresentationContext(
        {
          '@context': 'http://example.com/other.jsonld',
        },
        {
          config: {
            enablePresentationContextValidation: false,
            presentationContextValue: 'http://example.com/presentation.jsonld',
          },
        }
      )
    ).toBeUndefined();
  });
  describe('string presentation context', () => {
    it('should fail empty presentation', () => {
      expect(() => validatePresentationContext({}, { config })).toThrowError(
        new Error('presentation @context is not set correctly')
      );
    });
    it('should fail string presentation context', () => {
      expect(() =>
        validatePresentationContext(
          {
            '@context': 'http://example.com/other.jsonld',
          },
          { config }
        )
      ).toThrowError(new Error('presentation @context is not set correctly'));
    });
    it('should pass string presentation context', () => {
      expect(
        validatePresentationContext(
          {
            '@context': 'http://example.com/presentation.jsonld',
          },
          { config }
        )
      ).toBeUndefined();
    });
  });
  describe('array presentation context', () => {
    it('should fail empty presentation', () => {
      expect(() => validatePresentationContext({}, { config })).toThrowError(
        new Error('presentation @context is not set correctly')
      );
    });
    it('should fail array presentation context', () => {
      expect(() =>
        validatePresentationContext(
          {
            '@context': [
              'http://example.com/alpha.jsonld',
              'http://example.com/omega.jsonld',
            ],
          },
          { config }
        )
      ).toThrowError(new Error('presentation @context is not set correctly'));
    });
    it('should pass array presentation context', () => {
      expect(
        validatePresentationContext(
          {
            '@context': [
              'http://example.com/alpha.jsonld',
              'http://example.com/presentation.jsonld',
              'http://example.com/omega.jsonld',
            ],
          },
          { config }
        )
      ).toBeUndefined();
    });
  });
});
