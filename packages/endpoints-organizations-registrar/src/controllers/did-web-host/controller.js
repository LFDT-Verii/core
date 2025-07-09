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

const {
  didServiceSchema,
  modifyDidServiceSchema,
} = require('@verii/common-schemas');
const { uriToDidWeb } = require('@verii/did-web');
const {
  publicKeySchema,
  didProofSchema,
  didDocSchema,
} = require('../resolve-did/schemas');

const didWebHostController = async (fastify) => {
  fastify
    .addSchema(modifyDidServiceSchema)
    .addSchema(didServiceSchema)
    .addSchema(publicKeySchema)
    .addSchema(didProofSchema)
    .addSchema(didDocSchema);
  fastify.get(
    '/:website/did.json',
    {
      schema: fastify.autoSchema({
        response: {
          200: { $ref: 'did-doc#' },
        },
        tags: ['did-documents'],
      }),
    },
    async (req) => {
      const {
        repos,
        url,
        config: { custodiedDidWebHost },
      } = req;
      const urlObj = new URL(custodiedDidWebHost);
      urlObj.pathname = url.slice(0, -9);
      const did = uriToDidWeb(urlObj.href);
      const organization = await repos.organizations.findOneByDid(did);
      return organization.didDoc;
    }
  );
};

// eslint-disable-next-line better-mutation/no-mutation
didWebHostController.prefixOverride = '/d';

module.exports = didWebHostController;
