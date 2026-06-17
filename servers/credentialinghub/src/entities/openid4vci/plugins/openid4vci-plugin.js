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

const crypto = require('crypto');
const fp = require('fastify-plugin');
const newError = require('http-errors');
const { Openid4vciIssuer } = require('@openid4vc/openid4vci');
const {
  Oauth2AuthorizationServer,
  Oauth2ErrorCodes,
} = require('@openid4vc/oauth2');
const { castArray, isEmpty } = require('lodash/fp');
const {
  compact,
  filter,
  flow,
  includes,
  map,
  split,
  toLower,
  fromPairs,
  uniq,
} = require('lodash/fp');
const {
  getCredentialTypeMetadata,
  getOrganizationVerifiedProfile,
} = require('@verii/common-fetchers');
const { ServiceCategories } = require('@verii/organizations-registry');
const { KeyPurposes } = require('@verii/crypto');
const { getJwkFromDidUri } = require('@verii/did-doc');
const { jwtVerify } = require('@verii/jwt');

const openid4vciPlugin = async (fastify) => {
  fastify.decorateRequest(
    'getOpenId4VciIssuer',
    async function getOpenId4VciIssuer() {
      return buildIssuer(this);
    },
  );
  fastify.decorate('openid4vcErrorHandler', (error, request, reply) => {
    if (error.statusCode === 401) {
      reply.status(error.statusCode);
      return {
        error: error.message,
        error_description: error.message,
      };
    }
    if (error.code === 'FST_ERR_VALIDATION') {
      reply.status(error.statusCode);
      return {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: error.message,
      };
    }
    if (error.errorResponse == null) {
      throw error;
    }
    reply.status(error.status);
    return error.errorResponse;
  });
  fastify.decorate('openid4vcBearerAuth', async (req) => {
    const throwInvalidToken = () => {
      throw newError(401, 'invalid_token', {
        error: 'invalid_token',
        error_description: 'invalid_token',
      });
    };
    const authorizationHeader = req.headers.authorization;
    if (authorizationHeader == null) {
      throwInvalidToken();
    }
    const [bearerType, bearerValue] = split(' ', authorizationHeader);
    if (toLower(bearerType) !== 'bearer') {
      throwInvalidToken();
    }
    try {
      const claims = { subject: getIssuerUri(req) };
      await jwtVerify(
        bearerValue,
        req.tenant.keysByPurpose.EXCHANGES.publicJwk,
        claims,
      );
    } catch (e) {
      req.log.warn(e);
      throwInvalidToken();
    }
  });
};

const buildIssuer = async (context) => {
  const {
    tenant,
    kms,
    config: { credentialExtensionsContextUrl },
  } = context;

  const generateRandom = (bytes) => crypto.randomBytes(bytes);
  const signJwt = async (signer, { payload }) => {
    const exchangesKey = tenant.keysByPurpose[KeyPurposes.EXCHANGES];
    const jwt = await kms.signJwt(payload, exchangesKey._id);
    return {
      jwt,
      signerJwk: signer.publicJwk,
    };
  };
  const verifyJwt = async (signer, { compact: jwt }) => {
    try {
      const signerJwk = getJwkFromDidUri(signer.didUrl);
      await jwtVerify(jwt, signerJwk);
      return { verified: true, signerJwk };
    } catch {
      return { verified: false };
    }
  };

  const encryptString = (data) => {
    const exchangesKey = tenant.keysByPurpose[KeyPurposes.EXCHANGES];
    return kms.encryptString(data, exchangesKey._id);
  };

  const hash = (data, alg) =>
    crypto.createHash(alg.replace('-', '').toLowerCase()).update(data).digest();
  const clientAuthentication = (
    (_options) =>
    ({ body }) => {
      // eslint-disable-next-line better-mutation/no-mutation
      body.client_id = _options.clientId;
    }
  )({ clientId: 'some-random-client-id' });
  const issuer = new Openid4vciIssuer({
    callbacks: {
      signJwt,
      verifyJwt,
      parseXwwwFormUrlEncoded: (text) =>
        Object.fromEntries(Array.from(new URLSearchParams(text).entries())),
      hash,
      generateRandom,
      clientAuthentication,
    },
  });
  const authorizationServer = new Oauth2AuthorizationServer({
    callbacks: {
      signJwt,
      hash,
      verifyJwt,
      generateRandom,
      clientAuthentication,
    },
  });

  const openIdIssuer = getIssuerUri(context);
  const openIdOauthRoot = `${openIdIssuer}/oauth`;

  const getCredentialIssuerMetadata = async () => {
    const { credentialMetadataList, profile } =
      await fetchCredentialTypesAndProfile(context);
    const permittedIssuerCategories = toIssuerCategories(
      profile.permittedVelocityServiceCategory,
    );

    const credentialConfigurationsSupported = flow(
      filter((credentialMetadata) =>
        includes(credentialMetadata.issuerCategory, permittedIssuerCategories),
      ),
      map((credentialMetadata) => [
        toCredentialConfigurationId(credentialMetadata.credentialType),
        {
          format: 'jwt_vc_json-ld',
          cryptographic_binding_methods_supported: ['did:jwk'],
          credential_signing_alg_values_supported: ['ES256K'],
          credential_definition: {
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              credentialExtensionsContextUrl,
            ],
            type: ['VerifiableCredential', credentialMetadata.credentialType],
          },
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256', 'ES256K'],
            },
          },
        },
      ]),
      fromPairs,
    )(credentialMetadataList);
    const credentialIssuerMetadata = issuer.createCredentialIssuerMetadata({
      credential_issuer: openIdIssuer,
      credential_endpoint: `${openIdIssuer}/credential`,
      nonce_endpoint: `${openIdIssuer}/nonce`,
      deferred_credential_endpoint: `${openIdIssuer}/deferred_credential`,
      notification_endpoint: `${openIdIssuer}/notification`,
      display: [
        {
          name: tenant.name,
          logo: {
            uri: tenant.logo,
            alt_text: tenant.name,
          },
          locale: 'en',
        },
      ],
      credential_configurations_supported: credentialConfigurationsSupported,
      authorization_servers: [openIdOauthRoot],
    });
    return credentialIssuerMetadata;
  };

  const getAuthorizationServerMetadata = () => ({
    issuer: `${openIdIssuer}`,
    token_endpoint: `${openIdOauthRoot}/token`,
    token_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
    authorization_endpoint: `${openIdOauthRoot}/authorize`,
    jwks_uri: `${openIdOauthRoot}/jwks.json`,
    code_challenge_methods_supported: ['S256'],
    dpop_signing_alg_values_supported: ['ES256'],
    require_pushed_authorization_requests: true,
    'pre-authorized_grant_anonymous_access_supported': true,
    pushed_authorization_request_endpoint: `${openIdOauthRoot}/par`,
  });

  const createCredentialOffer = async (offerCredentialTypes, preauthCode) => {
    const credentialConfigurationIds = map(
      toCredentialConfigurationId,
      offerCredentialTypes,
    );
    const createdCredentialOffer = await issuer.createCredentialOffer({
      credentialConfigurationIds,
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preauthCode,
        },
      },
      issuerMetadata: {
        credentialIssuer: await getCredentialIssuerMetadata(),
        authorizationServers: [await getAuthorizationServerMetadata()],
      },
    });
    return createdCredentialOffer.credentialOffer;
  };

  const getCredentialRequest = async (parameters) => {
    const credentialRequest = issuer.parseCredentialRequest({
      credentialRequest: {
        credential_identifier: parameters.credential_identifier,
        proofs: {
          jwt: castArray(parameters.proofs?.jwt),
        },
      },
    });
    const issuerMetadata = {
      credentialIssuer: openIdIssuer,
    };
    if (isEmpty(credentialRequest.proofs.jwt)) {
      await issuer.verifyCredentialRequestJwtProof({
        jwt: '',
        issuerMetadata,
        callbacks: {
          verifyJwt,
        },
      });
    }
    await Promise.all(
      map(
        async (jwt) =>
          issuer.verifyCredentialRequestJwtProof({
            jwt,
            issuerMetadata,
            callbacks: {
              verifyJwt,
            },
          }),
        credentialRequest.proofs.jwt,
      ),
    );
    return credentialRequest;
  };

  const createNonce = async () =>
    issuer.createNonceResponse({
      cNonce: await encryptString(`${Date.now()}`),
    });
  const generateAccessToken = async (
    accessTokenParams,
    authorizationDetails,
    expiresInSeconds,
  ) => {
    const authorizationServerMetadata = getAuthorizationServerMetadata();
    const accessTokenResponse =
      await authorizationServer.createAccessTokenResponse({
        callbacks: {
          signJwt,
          generateRandom,
          hash,
        },
        authorizationServer: authorizationServerMetadata.authorization_endpoint,
        signer: {
          method: 'jwk',
          publicJwk: tenant.keysByPurpose[KeyPurposes.EXCHANGES].publicJwk,
          alg: tenant.keysByPurpose[KeyPurposes.EXCHANGES].algorithm,
        },
        expiresInSeconds,
        audience: authorizationServerMetadata.issuer,
        subject: openIdIssuer,
        additionalAccessTokenResponsePayload: {
          authorization_details: authorizationDetails,
        },
      });
    return accessTokenResponse;
  };
  const validateAccessTokenParams = async (accessTokenParams, { raw: req }) => {
    authorizationServer.parseAccessTokenRequest({
      request: {
        method: req.method,
        url: req.url,
        headers: new Headers(req.headers),
      },
      accessTokenRequest: accessTokenParams,
    });
  };

  const verifyPreauthCode = async (
    preauthCode,
    expectedPreAuthorizedCode,
    accessTokenParams,
    _context,
  ) =>
    authorizationServer.verifyPreAuthorizedCodeAccessTokenRequest({
      grant: {
        grantType: accessTokenParams.grant_type,
        preAuthorizedCode: preauthCode,
        txCode: accessTokenParams.tx_code,
      },
      accessTokenRequest: accessTokenParams,
      request: {
        method: _context.raw.method,
        url: _context.raw.url,
        headers: new Headers(_context.raw.headers),
      },
      expectedPreAuthorizedCode,
      expectedTxCode: undefined,
      preAuthorizedCodeExpiresAt: undefined,
    });

  return {
    createCredentialOffer,
    createNonce,
    generateAccessToken,
    validateAccessTokenParams,
    verifyPreauthCode,
    getAuthorizationServerMetadata,
    getCredentialIssuerMetadata,
    getCredentialRequest,
  };
};

const fetchWithErrorHandling = async (fetcherFunc, message, context) => {
  try {
    return await fetcherFunc();
  } catch (error) {
    context.log.error(message, error);
    throw newError(502, error.message);
  }
};

const ServiceCategoryToIssuerCategoryMap = {
  [ServiceCategories.Issuer]: 'RegularIssuer',
  [ServiceCategories.NotaryIssuer]: 'RegularIssuer',
  [ServiceCategories.IdDocumentIssuer]: 'IdDocumentIssuer',
  [ServiceCategories.NotaryIdDocumentIssuer]: 'IdDocumentIssuer',
  [ServiceCategories.ContactIssuer]: 'ContactIssuer',
  [ServiceCategories.NotaryContactIssuer]: 'ContactIssuer',
};

const toIssuerCategories = (permittedVelocityServiceCategory) =>
  flow(
    map(
      (serviceCategory) => ServiceCategoryToIssuerCategoryMap[serviceCategory],
    ),
    compact,
    uniq,
  )(permittedVelocityServiceCategory);

const toCredentialConfigurationId = (credentialType) =>
  `foundation.velocitynetwork.${credentialType}`;

const fetchCredentialTypesAndProfile = async (context) => {
  const { tenant } = context;
  const [credentialMetadataList, { credentialSubject: profile }] =
    await Promise.all([
      fetchWithErrorHandling(
        () => getCredentialTypeMetadata([], context),
        'Error loading credential metadata',
        context,
      ),

      fetchWithErrorHandling(
        () => getOrganizationVerifiedProfile(tenant.did, context),
        'Error loading profile',
        context,
      ),
    ]);
  return { credentialMetadataList, profile };
};

const getIssuerUri = (context) =>
  `${context.config.hostUrl}/r/${context.tenant._id}`;

module.exports = {
  openid4vciPlugin: fp(openid4vciPlugin, {
    name: 'openid4vci-plugin',
    dependencies: [],
  }),
};
