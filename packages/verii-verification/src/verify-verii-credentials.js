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
const { initHttpClient } = require('@verii/http-client');
const fetchers = require('@verii/common-fetchers');
const { verifyCredentials } = require('./verify-credentials');

const verifyVeriiCredentials = async (
  { credentials, expectedHolderDid, relyingParty },
  context
) => {
  const httpClient = initHttpClient({
    nodeEnv: context.config.nodeEnv,
    requestTimeout: context.config.requestTimeout,
    traceIdHeader: context.config.traceIdHeader,
    prefixUrl: context.config.registrarUrl,
    useExistingGlobalAgent: context.useExistingGlobalAgent,
  });

  // eslint-disable-next-line better-mutation/no-mutation
  context.registrarFetch = httpClient(context.config.registrarUrl, context);
  if (context?.tenant?.id == null) {
    // eslint-disable-next-line better-mutation/no-mutation
    context.tenant = { did: relyingParty.did };
  }

  return verifyCredentials(
    { credentials, expectedHolderDid, relyingParty },
    fetchers,
    context
  );
};

module.exports = { verifyVeriiCredentials };
