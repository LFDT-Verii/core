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

const fp = require('fastify-plugin');
const { includes } = require('lodash/fp');
const { ServiceCategories } = require('@verii/organizations-registry');
const { getOrganizationVerifiedProfile } = require('@verii/common-fetchers');

const getStatusCode = (error) => {
  const { response } = error;

  return response || error || {};
};

async function validateCao() {
  const context = this;

  if (!context.config.validateCaoDid) {
    context.log.warn('CAO DID validation is turned off.');

    return;
  }

  const registrarFetch = context.baseRegistrarFetch(context);
  const caoErrorMessage =
    // eslint-disable-next-line max-len
    'The provided CAO is not permitted to operator on the network. Make sure the organization exists on the registrar and is approved for Credential Agent Operation';
  let profile;
  context.log.info('Validating CAO');
  context.log.info({ caoDid: context.config.caoDid });
  try {
    profile = await getOrganizationVerifiedProfile(context.config.caoDid, {
      registrarFetch,
    });
  } catch (error) {
    context.log.info({ error });
    const { statusCode } = getStatusCode(error);

    switch (true) {
      case statusCode >= 400 && statusCode < 500:
        throw new Error(caoErrorMessage);
      default:
        context.log.warn(
          'The registrar was not available for the request. Please check your firewall settings.',
        );
        break;
    }

    return;
  }

  checkServiceCategories(profile, caoErrorMessage);
}

const checkServiceCategories = (profile, caoErrorMessage) => {
  if (
    !includes(
      ServiceCategories.CredentialAgentOperator,
      profile?.credentialSubject?.permittedVelocityServiceCategory,
    )
  ) {
    throw new Error(caoErrorMessage);
  }
};

const validateCaoPlugin = (fastify, options, next) => {
  if (!fastify.config.isTest) {
    fastify.addHook('onReady', validateCao);
  }
  next();
};

module.exports = { validateCaoPlugin: fp(validateCaoPlugin), validateCao };
