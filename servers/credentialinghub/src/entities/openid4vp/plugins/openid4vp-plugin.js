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

const fp = require('fastify-plugin');
const { Openid4vpVerifier } = require('@openid4vc/openid4vp');
const {
  Oauth2Error,
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
} = require('@openid4vc/oauth2');
const { KeyPurposes } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');

const openid4vpPlugin = async (fastify) => {
  fastify.decorateRequest(
    'getOpenId4VpVerifier',
    async function getOpenId4VpVerifier() {
      return buildVerifier(this);
    },
  );
  fastify.decorate('openid4vpErrorHandler', (error, request, reply) => {
    if (error.code === 'FST_ERR_VALIDATION') {
      reply.status(error.statusCode);
      return {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: getOpenid4vpValidationErrorDescription(error),
      };
    }
    if (error.errorResponse == null) {
      const statusCode = error.statusCode ?? 500;
      reply.status(statusCode);
      if (statusCode >= 500) {
        request.log.error(error);
        return {
          error: Oauth2ErrorCodes.ServerError,
          error_description: 'Unexpected server error',
        };
      }
      return {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: error.message,
      };
    }
    reply.status(error.status);
    return error.errorResponse;
  });
};

const getOpenid4vpValidationErrorDescription = (error) => {
  if (
    error.validation?.some(
      ({ instancePath, keyword }) =>
        instancePath === '/vp_token' && keyword === 'pattern',
    )
  ) {
    return 'OpenID4VP VP token is missing';
  }

  if (error.validation == null || error.validation.length === 0) {
    return error.message;
  }

  return `${error.validationContext}${error.validation[0].instancePath} ${error.validation[0].message}`;
};

const buildVerifier = (context) => {
  const { tenant } = context;
  const exchangesKey = tenant.keysByPurpose[KeyPurposes.EXCHANGES];
  const signer = {
    method: 'did',
    didUrl: toDidUrl(tenant.did, exchangesKey.kidFragment),
    alg: 'ES256K',
    kid: toDidUrl(tenant.did, exchangesKey.kidFragment),
  };
  const verifier = new Openid4vpVerifier({
    callbacks: {
      signJwt: (jwtSigner, jwt) => signJwt(jwtSigner, jwt, context),
      encryptJwe: () => {
        throw new Error('OpenID4VP encrypted responses are not supported');
      },
      verifyJwt: () => {
        throw new Error('OpenID4VP response verification is not implemented');
      },
      decryptJwe: () => {
        throw new Error('OpenID4VP encrypted responses are not supported');
      },
      hash: () => {
        throw new Error('OpenID4VP transaction data is not implemented');
      },
    },
  });

  const createAuthorizationRequestJwt = async ({
    requestId,
    authorizationRequestPayload,
    requestUri,
    expiresInSeconds,
    walletNonce,
  }) => {
    const { jar } = await verifier.createOpenId4vpAuthorizationRequest({
      authorizationRequestPayload,
      wallet: { expectedNonce: walletNonce },
      jar: {
        requestUri,
        jwtSigner: signer,
        expiresInSeconds,
        additionalJwtPayload: {
          iss: authorizationRequestPayload.client_id,
          jti: requestId,
        },
      },
    });

    return jar.authorizationRequestJwt;
  };

  const parseAuthorizationResponse = async (options) => {
    try {
      return await verifier.parseOpenid4vpAuthorizationResponse(options);
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        throw error;
      }
      if (error instanceof Oauth2Error) {
        throw new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: error.message,
          },
          { status: 400 },
        );
      }
      throw error;
    }
  };

  return { createAuthorizationRequestJwt, parseAuthorizationResponse };
};

const signJwt = async (jwtSigner, { header, payload }, context) => {
  const { kms, tenant } = context;
  const exchangesKey = tenant.keysByPurpose[KeyPurposes.EXCHANGES];
  const jwt = await kms.signJwt(payload, exchangesKey._id, {
    alg: jwtSigner.alg,
    kid: header.kid,
    typ: header.typ,
  });

  return {
    jwt,
    signerJwk: exchangesKey.publicJwk,
  };
};

module.exports = {
  openid4vpPlugin: fp(openid4vpPlugin, {
    name: 'openid4vp-plugin',
    dependencies: [],
  }),
};
