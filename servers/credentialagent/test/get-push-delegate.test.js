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

const {
  getPushDelegate,
} = require('../src/entities/push-delegate/get-push-delegate');

describe('push delegate', () => {
  describe('GetPushDelegate', () => {
    it('should handle full push_delegate from request', async () => {
      const baseQuery = {
        push_url: 'random',
        push_token: 'token',
      };
      const result = getPushDelegate(baseQuery);

      expect(result).toEqual({
        pushToken: baseQuery.push_token,
        pushUrl: baseQuery.push_url,
      });
    });

    it('should return undefined if push_delegate does not have push_token', async () => {
      const baseQuery = {
        push_url: 'url',
      };
      const result = getPushDelegate(baseQuery);

      expect(result).toEqual(undefined);
    });

    it('should return undefined if push_delegate does not have push_url', async () => {
      const baseQuery = {
        push_token: 'token',
      };
      const result = getPushDelegate(baseQuery);

      expect(result).toEqual(undefined);
    });
  });
});
