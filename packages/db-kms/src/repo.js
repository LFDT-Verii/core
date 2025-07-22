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
/** @import { FastifyInstance } from "fastify" */
/** @import { RepoInstance } from "@spencejs/spence-mongo-repos" */
/** @import { Context } from "../../types/types" */

const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  initEncryptPropExtension,
} = require('@verii/spencer-mongo-extensions');
const { defaultRepoOptions } = require('./default-repo-options');

/**
 * returns a repo
 * @param {FastifyInstance} app the app
 * @param {Record<string, string>} options the options for this repo
 * @param {(err?: Error) => void} next the next function for this repo
 * @returns {(Context) => RepoInstance} a spencer mongo repository
 */
module.exports = (app, options = defaultRepoOptions, next = () => {}) => {
  next();
  return repoFactory({
    name: options.name,
    entityName: options.entityName,
    defaultProjection: options.defaultProjection,
    extensions: [
      autoboxIdsExtension,
      initEncryptPropExtension({
        prop: options.keyProp,
        encryptedProp: options.encryptedKeyProp,
        secret: app.config[options.symmetricEncryptionKey],
        format: options.keyFormat,
      }),
      initEncryptPropExtension({
        prop: options.secretProp,
        encryptedProp: options.encryptedSecretProp,
        secret: app.config[options.symmetricEncryptionKey],
        format: 'string',
      }),
      ...options.extensions,
    ],
  });
};
