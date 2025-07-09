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

const buildFastify = require('./helpers/build-fastify');

describe('service types controller', () => {
  let fastify;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('Should get service types', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/service-types',
      payload: {},
    });
    expect(response.json).toEqual({
      serviceTypes: [
        {
          notary: false,
          serviceCategory: 'Inspector',
          serviceType: 'VlcInspector_v1',
        },
        {
          credentialGroup: 'Contact',
          notary: true,
          serviceCategory: 'NotaryIssuer',
          serviceType: 'VlcNotaryIssuer_v1',
        },
        {
          notary: false,
          serviceCategory: 'HolderAppProvider',
          serviceType: 'VlcHolderAppProvider_v1',
        },
        {
          notary: false,
          serviceCategory: 'HolderAppProvider',
          serviceType: 'VlcWebWalletProvider_v1',
        },
        {
          notary: false,
          serviceCategory: 'NodeOperator',
          serviceType: 'VlcNodeOperator_v1',
        },
        {
          notary: false,
          serviceCategory: 'CredentialAgentOperator',
          serviceType: 'VlcCredentialAgentOperator_v1',
        },
        {
          credentialGroup: 'Career',
          notary: false,
          serviceCategory: 'Issuer',
          serviceType: 'VlcCareerIssuer_v1',
        },
        {
          credentialGroup: 'IdDocument',
          notary: false,
          serviceCategory: 'IdDocumentIssuer',
          serviceType: 'VlcIdDocumentIssuer_v1',
        },
        {
          credentialGroup: 'IdDocument',
          notary: true,
          serviceCategory: 'NotaryIdDocumentIssuer',
          serviceType: 'VlcNotaryIdDocumentIssuer_v1',
        },
        {
          credentialGroup: 'Contact',
          notary: false,
          serviceCategory: 'ContactIssuer',
          serviceType: 'VlcContactIssuer_v1',
        },
        {
          credentialGroup: 'Contact',
          notary: true,
          serviceCategory: 'NotaryContactIssuer',
          serviceType: 'VlcNotaryContactIssuer_v1',
        },
        {
          notary: false,
          serviceCategory: 'IdentityIssuer',
          serviceType: 'VlcIdentityIssuer_v1',
        },
      ],
    });
  });
});
