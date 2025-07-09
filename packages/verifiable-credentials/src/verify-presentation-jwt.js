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
const { VnfProtocolVersions } = require('@verii/vc-checks');
const { getJwkFromDidUri } = require('@verii/did-doc');
const newError = require('http-errors');

const verifyVerifiablePresentationJwt = async (
  presentationJwt,
  { vnfProtocolVersion }
) => {
  try {
    if (vnfProtocolVersion < VnfProtocolVersions.VNF_PROTOCOL_VERSION_2) {
      return await verifyPresentationJwt(presentationJwt);
    }

    const { header } = jwtDecode(presentationJwt);
    const jwk = await getJwkFromDidUri(header.kid);
    return await verifyPresentationJwt(presentationJwt, jwk);
  } catch (error) {
    throw newError(400, `Malformed jwt_vp property: ${error.message}`, {
      errorCode: 'presentation_malformed',
    });
  }
};

module.exports = { verifyVerifiablePresentationJwt };
