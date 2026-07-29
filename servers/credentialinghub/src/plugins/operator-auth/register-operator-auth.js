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
 */

const fp = require('fastify-plugin');
const { defaultOperatorAuthPlugin } = require('./default-operator-auth-plugin');

const TENANT_ISOLATION_MODES = new Set(['legacy', 'cao']);
const PRINCIPAL_STRING_FIELDS = [
  'subject',
  'subjectType',
  'authenticationMethod',
];

const isObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const validateExtension = (extension) => {
  if (!isObject(extension)) {
    throw new TypeError('operatorAuthExtension must be an object');
  }
  if (typeof extension.plugin !== 'function') {
    throw new TypeError('operatorAuthExtension.plugin must be a function');
  }
  if (!TENANT_ISOLATION_MODES.has(extension.tenantIsolation)) {
    throw new TypeError(
      "operatorAuthExtension.tenantIsolation must be 'legacy' or 'cao'",
    );
  }
  if (extension.documentation != null && !isObject(extension.documentation)) {
    throw new TypeError(
      'operatorAuthExtension.documentation must be an object',
    );
  }
};

const assertNonEmptyPrincipalField = (principal, field) => {
  if (typeof principal[field] !== 'string' || principal[field].length === 0) {
    throw new TypeError(
      `operatorPrincipal.${field} must be a non-empty string`,
    );
  }
};

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

const normalizeCaoDid = (caoDid, tenantIsolation) => {
  if (tenantIsolation === 'cao') {
    if (!isNonEmptyString(caoDid)) {
      throw new TypeError(
        'operatorPrincipal.caoDid must be a non-empty string for CAO isolation',
      );
    }
    return caoDid;
  }
  if (caoDid == null) {
    return null;
  }
  if (!isNonEmptyString(caoDid)) {
    throw new TypeError(
      'operatorPrincipal.caoDid must be null or a non-empty string',
    );
  }
  return caoDid;
};

const normalizePrincipal = (principal, tenantIsolation) => {
  if (!isObject(principal)) {
    throw new TypeError('operatorPrincipal must be an object');
  }

  for (const field of PRINCIPAL_STRING_FIELDS) {
    assertNonEmptyPrincipalField(principal, field);
  }

  return {
    caoDid: normalizeCaoDid(principal.caoDid, tenantIsolation),
    subject: principal.subject,
    subjectType: principal.subjectType,
    authenticationMethod: principal.authenticationMethod,
  };
};

const installOperatorAuthPlugin = fp(
  async (fastify, { extension }) => {
    const resolvedExtension =
      extension == null
        ? {
            plugin: defaultOperatorAuthPlugin,
            tenantIsolation: 'legacy',
          }
        : extension;
    validateExtension(resolvedExtension);

    fastify
      .decorateRequest('operatorPrincipal', null)
      .decorate('operatorTenantIsolation', resolvedExtension.tenantIsolation);

    await fastify.register(resolvedExtension.plugin);

    if (
      !fastify.hasDecorator('authenticateOperator') ||
      typeof fastify.authenticateOperator !== 'function'
    ) {
      throw new TypeError(
        'operator authentication plugin must decorate authenticateOperator',
      );
    }

    const { authenticateOperator } = fastify;
    // Replace the capability implementation with the stable, validating seam.
    // eslint-disable-next-line better-mutation/no-mutation
    fastify.authenticateOperator = async function authenticateAndNormalize(
      request,
      reply,
    ) {
      await authenticateOperator.call(this, request, reply);
      if (!reply.sent) {
        // eslint-disable-next-line better-mutation/no-mutation
        request.operatorPrincipal = normalizePrincipal(
          request.operatorPrincipal,
          resolvedExtension.tenantIsolation,
        );
      }
    };
  },
  { name: 'credentialingHubOperatorAuth' },
);

const registerOperatorAuth = (server, extension) =>
  server.register(installOperatorAuthPlugin, { extension });

module.exports = { registerOperatorAuth };
