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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const fp = require('fastify-plugin');
const { isEmpty } = require('lodash/fp');

const loadGroup = async (db, req) => {
  const { tenant } = req;
  return db.collection('groups').findOne(
    {
      dids: tenant.did,
    },
    {
      _id: 1,
      dids: 1,
    }
  );
};

const groupLoaderPlugin = (fastify, options, next) => {
  fastify.decorateRequest('group', null);
  fastify.decorateRequest('caoDid', null);
  fastify.addHook('onRequest', async (req) => {
    req.group = await loadGroup(mongoDb(), req);
    req.caoDid = getCaoDid(req);
  });
  next();
};

const getCaoDid = (context) => {
  const { group, config } = context;
  return isEmpty(group) ? config.caoDid : group._id;
};

module.exports = {
  groupLoaderPlugin: fp(groupLoaderPlugin),
};
