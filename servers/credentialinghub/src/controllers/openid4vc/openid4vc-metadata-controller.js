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

const cors = require('@fastify/cors');
const { KeyPurposes } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');
const {
  getCredentialIssuerMetadata,
  getAuthorizationServerMetadata,
} = require('../../entities/openid4vci');

const APPLICATION_JWT_MEDIA_TYPE = 'application/jwt';
const openid4vcMetadataController = async (fastify) => {
  fastify
    .register(cors, { origin: true })
    .get(
      '/.well-known/openid-credential-issuer/r/:tenantId',
      async (req, reply) => {
        const credentialIssuerMetadata = await getCredentialIssuerMetadata(req);
        if (req.headers.accept?.includes(APPLICATION_JWT_MEDIA_TYPE)) {
          reply.type(APPLICATION_JWT_MEDIA_TYPE);
          const exchangesKey = req.tenant.keysByPurpose[KeyPurposes.EXCHANGES];
          return req.kms.signJwt(credentialIssuerMetadata, exchangesKey._id, {
            issuer: req.tenant.did,
            subject: req.tenant.did,
            kid: toDidUrl(req.tenant.did, exchangesKey.kidFragment),
            expiresIn: '1w',
          });
        }
        return credentialIssuerMetadata;
      },
    )
    .get('/.well-known/oauth-authorization-server/r/:tenantId', async (req) => {
      const authorizationServerMetadata =
        await getAuthorizationServerMetadata(req);
      const exchangesKey = req.tenant.keysByPurpose[KeyPurposes.EXCHANGES];
      return {
        signed_metadata: await req.kms.signJwt(
          authorizationServerMetadata,
          exchangesKey._id,
          {
            issuer: req.tenant.did,
            subject: req.tenant.did,
            kid: toDidUrl(req.tenant.did, exchangesKey.kidFragment),
            expiresIn: '1w',
          },
        ),
      };
    });
};

module.exports = openid4vcMetadataController;
