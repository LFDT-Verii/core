/*
 * Copyright 2024 Velocity Team
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

const { startsWith } = require('lodash/fp');
const newError = require('http-errors');
const { resolveKid } = require('@verii/common-fetchers');
const { getJwkFromDidUri } = require('@verii/did-doc');
const { jwtVerify, jwtDecode } = require('@verii/jwt');
const { verifyIssuingChallenge } = require('./verify-issuing-challenge');

const verifyProofOfKeyPossession = async (proof, exchange, context) => {
  verifyProofStructure(proof);
  const jwk = await resolveDidAndJwk(proof.jwt, context);
  const { header, payload } = await doJwtVerify(proof.jwt, jwk);

  await validateContent(payload, header, exchange, context);

  return payload.iss;
};

const doJwtVerify = (jwt, jwk) =>
  jwtVerify(jwt, jwk).catch(() => {
    throw newError(400, 'proof_verify_failed', {
      errorCode: 'proof_verify_failed',
    });
  });

const verifyProofStructure = (proof) => {
  if (proof == null) {
    throw newError(400, 'proof_required', {
      errorCode: 'proof_required',
    });
  }
};

const resolveDidAndJwk = async (jwt, context) => {
  const { header } = jwtDecode(jwt);

  if (header.kid == null) {
    throw newError(400, 'proof.jwt is missing a kid', {
      errorCode: 'proof_kid_required',
    });
  }

  try {
    if (startsWith('did:jwk', header.kid)) {
      return getJwkFromDidUri(header.kid);
    }

    const verificationMethod = await resolveKid(header, context);
    return verificationMethod.publicKeyJwk;
  } catch (error) {
    context.log.error(error);
    throw newError(400, 'proof_kid_invalid', {
      errorCode: 'proof_kid_invalid',
    });
  }
};

const validateContent = async (payload, { kid }, exchange, context) => {
  const {
    tenant: { hostUrl },
  } = context;

  if (payload.iss == null) {
    throw newError(400, 'proof_iss_required', {
      errorCode: 'proof_iss_required',
    });
  }

  if (!startsWith('did', payload.iss) || !startsWith(payload.iss, kid)) {
    throw newError(400, 'proof_iss_invalid', {
      errorCode: 'proof_iss_invalid',
    });
  }

  if (!startsWith(hostUrl, payload.aud)) {
    throw newError(400, 'proof_aud_invalid', {
      errorCode: 'proof_aud_invalid',
    });
  }

  await verifyChallenge(payload.nonce, exchange, context);
};

const throwExpiredChallengeError = () => {
  throw newError(400, 'proof_challenge_expired', {
    errorCode: 'proof_challenge_expired',
  });
};

const throwChallengeMismatchError = () => {
  throw newError(400, 'proof_challenge_mismatch', {
    errorCode: 'proof_challenge_mismatch',
  });
};

const throwChallengeVerificationError = (error) => {
  if (error?.code === 'ERR_JWT_EXPIRED' || error?.name === 'JWTExpired') {
    throwExpiredChallengeError();
  }

  throwChallengeMismatchError();
};

const verifyChallenge = async (nonce, { _id }, context) => {
  try {
    await verifyIssuingChallenge(nonce, _id, context);
  } catch (error) {
    throwChallengeVerificationError(error);
  }
};

module.exports = { verifyProofOfKeyPossession };
