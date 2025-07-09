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

const { getMimeType, ExtensionTypes, getImageFormat } = require('../src');

jest.mock('nanoid', () => ({
  nanoid: () => '1234',
}));

describe('Image-processing test suite', () => {
  describe('get mime type test suite', () => {
    it('should return image/jpeg', () => {
      const mimeType = getMimeType(ExtensionTypes.JPEG);
      expect(mimeType).toBe('image/jpeg');
    });

    it('should return image/png', () => {
      const mimeType = getMimeType(ExtensionTypes.PNG);
      expect(mimeType).toBe('image/png');
    });

    it('should return image/svg+xml', () => {
      const mimeType = getMimeType(ExtensionTypes.SVG);
      expect(mimeType).toBe('image/svg+xml');
    });

    it('should return image/jpg', () => {
      const mimeType = getMimeType(ExtensionTypes.JPG);
      expect(mimeType).toBe('image/jpg');
    });

    it('should return image/jpeg if type not defined', () => {
      const mimeType = getMimeType();
      expect(mimeType).toBe('image/jpeg');
    });
  });

  describe('get image format test suite', () => {
    it('should return image format', () => {
      const format = getImageFormat(
        { ContentType: 'image/png' },
        { format: ExtensionTypes.PNG }
      );
      expect(format).toBe(ExtensionTypes.PNG);
    });
  });
});
