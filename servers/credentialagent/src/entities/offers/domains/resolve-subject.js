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

const { first, startsWith, isEmpty, lastIndexOf } = require('lodash/fp');
const {
  jwtVerify,
  jwtHeaderDecode,
  jwkThumbprint,
} = require('@verii/jwt');
const newError = require('http-errors');
const { getUnixTime } = require('date-fns/fp');
const { resolveDidJwkDocument } = require('@verii/did-doc');

const resolveSubject = async (proof, context) => {
  verifyProofStructure(proof);
  const { jwk, did } = await resolveJwk(proof);

  await verifyProofJwt(context.exchange, proof, jwk, context);

  if (did != null) {
    return { id: did };
  }

  return { id: await jwkThumbprint(jwk), jwk };
};

const verifyProofStructure = (proof) => {
  if (proof == null) {
    throw newError(400, 'proof is missing', {
      errorCode: 'invalid_or_missing_proof',
    });
  }
  const { proof_type: proofType, jwt } = proof;
  if (proofType !== 'jwt') {
    throw newError(400, "proof_type isn't set to jwt", {
      errorCode: 'proof_type_invalid',
    });
  }

  if (isEmpty(jwt)) {
    throw newError(400, 'proof.jwt is missing', {
      errorCode: 'proof_jwt_is_required',
    });
  }
};

const decodeHeader = (jwt) => {
  try {
    return jwtHeaderDecode(jwt);
  } catch (error) {
    throw newError(400, 'proof.jwt is missing', {
      errorCode: 'bad_proof_jwt',
    });
  }
};

const resolveJwk = async ({ jwt }) => {
  const { jwk, kid } = decodeHeader(jwt);

  if (jwk == null && kid == null) {
    throw newError(400, 'proof.jwt is missing a kid', {
      errorCode: 'proof_one_of_jwk_kid_required',
    });
  }

  if (kid != null) {
    try {
      const didDocument = await resolveDidJwkDocument(
        extractDidJwkWithoutSuffix(kid)
      );
      return {
        did: didDocument.id,
        jwk: first(didDocument.verificationMethod).publicKeyJwk,
      };
    } catch (error) {
      throw newError(
        400,
        'kid in the jwt does not resolve to a supported DID document. (kid should be a did:jwk)',
        {
          errorCode: 'proof_invalid_kid',
        }
      );
    }
  }

  return { jwk };
};

const extractDidJwkWithoutSuffix = (jwkIdentifier) => {
  const endIndex = lastIndexOf('#', jwkIdentifier);
  return jwkIdentifier.substring(0, endIndex);
};

const verifyProofJwt = async (
  { challenge, challengeIssuedAt },
  { jwt },
  jwk,
  { config: { hostUrl, oidcTokensExpireIn } }
) => {
  let payload;
  try {
    const { payload: verifiedPayload } = await jwtVerify(jwt, jwk);
    payload = verifiedPayload;
  } catch (error) {
    throw newError(400, "proof.jwt isn't a jwt or signature is not correct", {
      errorCode: 'proof_bad_jwt',
    });
  }

  if (!startsWith(hostUrl, payload.aud)) {
    throw newError(400, 'The aud in the jwt is not correct', {
      errorCode: 'proof_bad_aud',
    });
  }

  if (payload.nonce !== challenge) {
    throw newError(
      400,
      'The nonce in the jwt does not match the supplied c_nonce',
      {
        errorCode: 'proof_challenge_mismatch',
      }
    );
  }

  if (challengeIssuedAt + oidcTokensExpireIn < getUnixTime(new Date())) {
    throw newError(400, 'The c_nonce in the jwt has expired', {
      errorCode: 'proof_challenge_expired',
    });
  }
};

module.exports = { resolveSubject };
