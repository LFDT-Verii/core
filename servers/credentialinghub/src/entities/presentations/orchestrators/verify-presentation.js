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
const { jwtDecode, verifyPresentationJwt } = require('@verii/jwt');
const { getJwkFromDidUri } = require('@verii/did-doc');
const { CheckResults } = require('@verii/vc-checks');
const { verifyCredentials } = require('@verii/verii-verification');
const { KeyPurposes } = require('@verii/crypto');
const {
  resolveDid,
  getOrganizationVerifiedProfile,
  getCredentialTypeMetadata,
} = require('@verii/common-fetchers');
const { flow, every, includes, map } = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const newError = require('http-errors');
const { PresentationFormat } = require('../domain/presentation-format');
const {
  CredentialFormat,
} = require('../../credentials/domain/credential-format');

const verifyPresentation = async (presentation, context) => {
  const { tenant } = context;
  const { header, payload } = jwtDecode(presentation);

  try {
    const jwk = header.jwk ?? getJwkFromDidUri(header.kid);
    await verifyPresentationJwt(presentation, jwk);
  } catch {
    return {
      format: PresentationFormat.JWT_VP,
      presentation,
      w3cPresentation: payload.vp,
      verification: {
        verified: false,
        tamperCheck: CheckResults.FAIL,
      },
    };
  }

  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = tenant.caoDid;

  const credentialCheckResults = await verifyCredentials(
    {
      credentials: payload.vp.verifiableCredential,
      expectedHolderDid: payload.iss,
      relyingParty: {
        dltOperatorKMSKeyId:
          tenant.keysByPurpose[KeyPurposes.DLT_TRANSACTIONS]._id,
      },
    },
    {
      resolveDid,
      getOrganizationVerifiedProfile,
      getCredentialTypeMetadata,
    },
    context,
  );

  const credentials = mapWithIndex((credentialCheckResult, index) => {
    const conclusion = calcCredentialConclusion(
      Object.values(credentialCheckResult.credentialChecks),
    );
    return {
      format: CredentialFormat.JWT_VC,
      credential: payload.vp.verifiableCredential[index],
      w3cCredential: credentialCheckResult.credential,
      conclusion,
      verified: conclusion === CheckResults.PASS,
      tamperCheck: credentialCheckResult.credentialChecks.UNTAMPERED,
      trustedIssuerCheck: credentialCheckResult.credentialChecks.TRUSTED_ISSUER,
      trustedHolderCheck: credentialCheckResult.credentialChecks.TRUSTED_HOLDER,
      revocationCheck: credentialCheckResult.credentialChecks.UNREVOKED,
      expiryCheck: credentialCheckResult.credentialChecks.UNEXPIRED,
    };
  }, credentialCheckResults);

  if (
    flow(
      map('conclusion'),
      includes(CheckResults.VOUCHER_RESERVE_EXHAUSTED),
    )(credentials)
  ) {
    throw newError(402, 'Verification vouchers exhausted', {
      errorCode: 'verification_payment_required',
    });
  }

  return {
    format: PresentationFormat.JWT_VP,
    presentation,
    w3cPresentation: payload.vp,
    verification: {
      verified: every(({ verified }) => verified, credentials),
      tamperCheck: CheckResults.PASS,
      credentials,
    },
  };
};

const calcCredentialConclusion = (vals) => {
  for (const val of vals) {
    if (val === CheckResults.VOUCHER_RESERVE_EXHAUSTED) {
      return CheckResults.VOUCHER_RESERVE_EXHAUSTED;
    }

    if (![CheckResults.PASS, CheckResults.NOT_APPLICABLE].includes(val)) {
      return CheckResults.FAIL;
    }
  }

  return CheckResults.PASS;
};

module.exports = {
  verifyPresentation,
};
