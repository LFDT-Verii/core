/*
 * Copyright 2025 Velocity Team
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

const { register } = require('@spencejs/spence-factories');

const { testRegistrarUser } = require('@verii/tests-helpers');
const imagesRepoPlugin = require('../repo');
const { ImageState } = require('../domain');

module.exports = (app) =>
  register(
    'image',
    imagesRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const userId = await getOrBuild('userId', () => testRegistrarUser.sub);

      return {
        userId,
        key: 'file-1234567.png',
        url: 'http://media.localhost.test/file-1234567.png',
        uploadUrl: 'http://aws.s3.test/file-1234567.png',
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides(),
      };
    },
  );
