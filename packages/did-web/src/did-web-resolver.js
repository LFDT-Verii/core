/**
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
 */

const { Resolver } = require('did-resolver');
const { getResolver } = require('web-did-resolver');
const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');

const webResolver = getResolver();
const didResolver = new Resolver(webResolver);

const isWebDid = (did) => /^did:web:.+/.test(did);

const resolveDidWeb = async (did) => {
  const doc = await didResolver.resolve(did);
  if (isEmpty(doc.didDocument)) {
    throw newError(400, `Could not resolve ${did}`, {
      errorCode: 'did_resolution_failed',
    });
  }
  return doc.didDocument;
};

module.exports = { resolveDidWeb, isWebDid };
