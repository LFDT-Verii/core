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

const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const {
  findIssuerServicesExtension,
} = require('./find-issuer-services-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'issuerServices',
      entityName: 'issuerService',
      defaultProjection: {
        _id: 1,
        velocityNetworkServiceId: 1,
        description: 1,
        termsUrl: 1,
        disclosureRequest: 1,
        presentationDefinition: 1,
        deactivationDate: 1,
        authTokensExpireIn: 1,
        authMethods: 1,
        authMode: 1,
        verifiablePresentationAuthRules: 1,
        challengesExpireIn: 1,
        credentialTypesAvailable: 1,
        autoCleanPII: 1,
        tenantId: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [
        autoboxIdsExtension,
        multitenantExtension(),
        findIssuerServicesExtension,
      ],
    },
    app,
  );
};
