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
const { first, flow, replace, split } = require('lodash/fp');
const newError = require('http-errors');

const webResolver = getResolver();
const didResolver = new Resolver(webResolver);

const isWebDid = (did) => /^did:web:.+/.test(did);

const resolveDidWeb = async (did) => {
  const { didDocument, didResolutionMetadata } = await didResolver.resolve(did);
  const failure = findResolutionFailure(
    did,
    didDocument,
    didResolutionMetadata,
  );
  if (failure != null) {
    throw newError(400, `Could not resolve ${did}: ${failure}`, {
      errorCode: 'did_resolution_failed',
    });
  }
  return didDocument;
};

const findResolutionFailure = (did, didDocument, { error, message }) => {
  if (error != null) {
    return summarizeResolverMessage(message ?? error);
  }
  if (didDocument?.id !== did) {
    return 'DID document id does not match requested did';
  }
  return undefined;
};

// Keep only the summary: web-did-resolver appends the underlying fetch error (URLs, network or parser details) after it.
const summarizeResolverMessage = flow(
  replace(/^resolver_error: /, ''),
  split(': '),
  first,
);

module.exports = { resolveDidWeb, isWebDid };
