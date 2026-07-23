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

const OPERATOR_TITLE = 'Velocity Credentialing Hub — Operator API';
const OPENID4VC_TITLE = 'Velocity Credentialing Hub — OpenID4VC Wallet API';
const VN_API_TITLE = 'Velocity Credentialing Hub — VN-API Wallet API';

const createAudienceTransform =
  (audience) =>
  ({ schema, url, route }) => {
    const { documentationSecurity } = route?.config ?? {};
    return {
      schema: {
        ...schema,
        ...(documentationSecurity == null
          ? {}
          : { security: documentationSecurity }),
        hide: route?.config?.documentationAudience !== audience,
      },
      url,
    };
  };

const createSwaggerConfig = (version) => ({
  swaggerInfo: {
    info: {
      title: OPERATOR_TITLE,
      description: 'APIs for managing Velocity Credentialing Hub services.',
      version,
    },
    components: {
      securitySchemes: {
        operatorBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Operator API token',
        },
      },
    },
    tags: [
      { name: 'Tenants', description: 'Manage Credentialing Hub tenants.' },
      {
        name: 'Issuer Services',
        description: 'Manage issuer services.',
      },
      {
        name: 'Relying Party Services',
        description: 'Manage relying party services.',
      },
      { name: 'Depots', description: 'Manage depots.' },
      { name: 'Credentials', description: 'Manage credentials.' },
      { name: 'Presentations', description: 'Verify presentations.' },
      { name: 'Issue Links', description: 'Manage issue links.' },
      {
        name: 'Presentation Links',
        description: 'Manage presentation links.',
      },
      { name: 'Exchanges', description: 'Inspect exchanges.' },
      { name: 'Utilities', description: 'Healthcheck and testing utilities.' },
    ],
  },
  swaggerOptions: {
    transform: createAudienceTransform('operator'),
  },
  swaggerDocuments: {
    primaryName: 'Operator API',
    documents: [
      {
        name: 'OpenID4VC Wallet API',
        url: '/documentation/openid4vc.json',
        decorator: 'openid4vcSwagger',
        openapi: {
          info: {
            title: OPENID4VC_TITLE,
            description: 'Wallet-facing OpenID4VC APIs.',
            version,
          },
          components: {
            securitySchemes: {
              openid4vcAccessToken: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'OpenID4VC access token',
              },
            },
          },
          tags: [
            { name: 'OpenID4VCI', description: 'OpenID4VC issuance APIs.' },
            { name: 'OpenID4VP', description: 'OpenID4VC presentation APIs.' },
            {
              name: 'Metadata & OAuth',
              description: 'OpenID4VC metadata and OAuth APIs.',
            },
          ],
        },
        transform: createAudienceTransform('openid4vc'),
      },
      {
        name: 'VN-API Wallet API',
        url: '/documentation/vn-api.json',
        decorator: 'vnApiSwagger',
        openapi: {
          info: {
            title: VN_API_TITLE,
            description: 'Wallet-facing VN-API APIs.',
            version,
          },
          components: {
            securitySchemes: {
              vnApiAccessToken: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'VN-API access token',
              },
            },
          },
          tags: [
            { name: 'Issuing', description: 'Credential issuing APIs.' },
            {
              name: 'Presentation',
              description: 'Credential presentation APIs.',
            },
          ],
        },
        transform: createAudienceTransform('vn-api'),
      },
    ],
  },
});

module.exports = { createSwaggerConfig };
