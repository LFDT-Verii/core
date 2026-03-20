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

const { jwtDecode, verifyPresentationJwt } = require('@verii/jwt');
const { VeriiProtocolVersions } = require('@verii/vc-checks');
const { getJwkFromDidUri } = require('@verii/did-doc');
const newError = require('http-errors');

const KID_AND_JWK_DEPRECATION_WARNING = [
  'jwt_vp contains both kid and jwk headers;',
  'using kid and ignoring jwk for backward compatibility.',
  'This will not be accepted after 2026-12-31T23:59:59Z,',
  'and this compatibility path will be removed.',
].join(' ');
const MISSING_CONTEXT_ERROR =
  'verifyVerifiablePresentationJwt requires a context object';
const MISSING_PROTOCOL_VERSION_ERROR =
  'verifyVerifiablePresentationJwt requires context.vnfProtocolVersion';
const MISSING_KID_AND_JWK_ERROR =
  'jwt_vp must include kid or jwk in the header';

const verifyVerifiablePresentationJwt = async (presentationJwt, context) => {
  if (context == null) {
    throw new TypeError(MISSING_CONTEXT_ERROR);
  }

  const protocolVersion = context.vnfProtocolVersion;
  const log = context.log ?? null;

  if (protocolVersion == null) {
    throw new TypeError(MISSING_PROTOCOL_VERSION_ERROR);
  }
  if (protocolVersion < VeriiProtocolVersions.PROTOCOL_VERSION_2) {
    return wrapVerifyPresentationJwt(presentationJwt);
  }

  const { header } = jwtDecode(presentationJwt);
  ensurePresentationHeaderIsSupported(header, log);

  const jwk = await wrapGetJwkFromDidUri(header.kid);
  return wrapVerifyPresentationJwt(presentationJwt, jwk);
};

const ensurePresentationHeaderIsSupported = ({ jwk, kid }, log) => {
  if (kid == null && jwk == null) {
    throw newError(400, MISSING_KID_AND_JWK_ERROR, {
      errorCode: 'presentation_malformed',
    });
  }
  if (kid == null) {
    throw newError(400, 'jwt_vp must not be self signed', {
      errorCode: 'presentation_malformed',
    });
  }
  if (jwk != null) {
    // After 2026-12-31, remove this warning-only compatibility path and
    // restore strict rejection for mixed kid+jwk headers as malformed input.
    // throw newError(400, 'jwt_vp must not include both kid and jwk', {
    //   errorCode: 'presentation_malformed',
    // });
    log?.warn(KID_AND_JWK_DEPRECATION_WARNING);
  }
};

const wrapGetJwkFromDidUri = async (kid) => {
  try {
    const jwk = await getJwkFromDidUri(kid);
    return jwk;
  } catch (error) {
    throw newError(400, `kid_${error.message}`, {
      errorCode: 'presentation_malformed',
    });
  }
};

const wrapVerifyPresentationJwt = async (presentationJwt, jwk) => {
  try {
    return await verifyPresentationJwt(presentationJwt, jwk);
  } catch (error) {
    throw newError(400, `Malformed jwt_vp property: ${error.message}`, {
      errorCode: 'presentation_malformed',
    });
  }
};

module.exports = {
  verifyVerifiablePresentationJwt,
};
