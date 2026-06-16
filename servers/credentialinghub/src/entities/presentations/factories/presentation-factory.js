/**
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
 */

const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const {
  generatePresentationJwt,
  generateCredentialJwt,
} = require('@verii/jwt');
const { generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc/src/did-jwk');
const { hashOffer } = require('@verii/verii-issuing');
const { initTenantFactory } = require('../../tenants/factories');
const { initDepotFactory } = require('../../depots/factories');
const { initExchangeFactory } = require('../../exchanges/factories');
const { PresentationFormat } = require('../domain/presentation-format');
const { presentationsRepoPlugin } = require('../repo');

const initPresentationFactory = (app) =>
  register(
    'presentation',
    presentationsRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const tenant = await getOrBuild('tenant', initTenantFactory(app));
      const depot = await getOrBuild('depot', initDepotFactory(app));
      const exchange = await getOrBuild('exchange', initExchangeFactory(app));
      const holderKeyPair = await getOrBuild('holderKey', defaultKeyPair);

      const vcContent = await getOrBuild('vcContent', defaultVcContent);
      const credentialDid = await getOrBuild(
        'credentialDid',
        defaultCredentialDid(vcContent),
      );
      const vcKeyPair = await getOrBuild('vcKeyPair', defaultKeyPair);

      const holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
      const vc = await generateCredentialJwt(
        createVcPayload(tenant, credentialDid, holderDid, vcContent),
        vcKeyPair.privateKey,
        `${credentialDid}#key-1`,
      );

      const presentation = await generatePresentationJwt(
        { verifiableCredential: [vc], issuer: holderDid },
        holderKeyPair.privateKey,
        `${holderDid}#key`,
      );

      return {
        format: PresentationFormat.JWT_VP,
        exchangeId: new ObjectId(exchange._id),
        depotId: new ObjectId(depot._id),
        tenantId: new ObjectId(tenant._id),
        presentation,
        ...overrides(),
      };
    },
  );

const defaultCredentialDid = (vcContent) => () =>
  `did:velocity:v2:A:1:i:${hashOffer(vcContent)}`;

const createVcPayload = (tenant, credentialDid, holderDid, content) => ({
  ...content,
  id: credentialDid,
  issuer: { id: tenant.did },
  credentialSubject: {
    id: holderDid,
    ...content.credentialSubject,
  },
});

const defaultVcContent = () => ({
  type: ['Employment'],
  credentialSubject: {
    legalEmployer: { name: 'ExampleEmployer', identifier: 'did:example.com' },
    roleName: 'CEO',
  },
});

const defaultKeyPair = () => generateKeyPair({ format: 'jwk' });

module.exports = { initPresentationFactory, defaultVcContent };
