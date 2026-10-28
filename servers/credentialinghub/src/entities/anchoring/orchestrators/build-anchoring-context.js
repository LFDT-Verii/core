/*
 * Copyright 2026 Velocity Team
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

const newError = require('http-errors');
const { bindRepo } = require('@spencejs/spence-mongo-repos');
const {
  initAuthenticateVnfBlockchainClient,
  initProvider,
} = require('@verii/base-contract-io');
const { initDbKms } = require('@verii/db-kms');
const { kmsOptions } = require('../../keys');

// The worker runs outside a request, so it builds the parts of a request's
// context that anchoring needs. Repos bound here have no tenant.
const buildAnchoringWorkerContext = (server) => {
  const context = { config: server.config, log: server.log, server };
  return {
    ...context,
    initKms: initDbKms(server, kmsOptions),
    repos: bindRepo(context),
  };
};

const buildAnchoringJobContext = async (job, workerContext) => {
  const { config, initKms, log, repos, server } = workerContext;
  const { tenantId } = job.payload;
  const tenant = await repos.tenants.findOne({ filter: { _id: tenantId } });
  if (tenant == null) {
    throw newError(404, 'Tenant not found', { errorCode: 'tenant_not_found' });
  }

  const context = {
    caoDid: tenant.caoDid,
    config,
    log: log.child({ anchoringJobId: job._id, tenantId }),
    server,
    tenant,
    traceId: job._id,
  };
  // A custom CAO security provider resolves blockchain credentials from this
  // context, as it would from a request.
  const vnfBlockchainAuthenticate = initAuthenticateVnfBlockchainClient(
    server,
    context,
  );
  return {
    ...context,
    kms: initKms(context),
    repos: bindRepo(context),
    rpcProvider: initProvider(
      config.rpcUrl,
      vnfBlockchainAuthenticate,
      config.chainId,
    ),
    vnfBlockchainAuthenticate,
  };
};

module.exports = { buildAnchoringJobContext, buildAnchoringWorkerContext };
