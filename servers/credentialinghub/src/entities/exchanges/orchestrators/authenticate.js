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
const {
  difference,
  every,
  filter,
  first,
  flow,
  includes,
  isArray,
  isEmpty,
  isPlainObject,
  isString,
  map,
  pick,
  size,
  some,
  split,
  values,
  zip,
} = require('lodash/fp');
const newError = require('http-errors');
const { ObjectId } = require('mongodb');
const {
  CredentialDataModelVersions,
  decodeCredentialEnvelope,
  jwtDecode,
} = require('@verii/jwt');
const { CheckResults, extractCredentialType } = require('@verii/vc-checks');
const { buildFailedCheckResultError } = require('@verii/verii-verification');
const { isPreauthCodeAuth } = require('../../links');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');
const {
  buildAuthRulesFingerprint,
} = require('../../depots/domain/auth-rules-fingerprint');
const {
  checkCredentials,
  validatePresentation,
} = require('../../presentations');
const { generateAccessToken } = require('../../tokens');
const {
  ExchangeErrors,
  ExchangeStates,
  buildCandidateTuples,
  validatePreauth,
  validateReferencedService,
} = require('../domain');

const MAX_PRESENTED_CREDENTIALS = 100;

// How far from now a VP's iat may be when it authenticates an exchange
const MAX_VP_AGE_SECONDS = 10 * 60;
const MAX_VP_FUTURE_SECONDS = 5 * 60;

// A check that is DEPENDENCY_RESOLUTION_ERROR means the ledger or the
// registrar could not be reached, not that the credential is bad.
const DEPENDENCY_CHECKS = ['UNTAMPERED', 'TRUSTED_ISSUER', 'UNREVOKED'];

// A VP authenticates only while it's fresh: its iat is at most 10 minutes old
// and 5 minutes ahead. It authenticates an exchange once. An exchange that has
// authenticated can authenticate again only with a new VP for the same depot,
// as a wallet does when NewOffersReady tells it that deferred credentials are
// ready. The VP is bound to its exchange by its definition_id, so this stops a
// captured VP being replayed.
//
// Freshness and the early read refuse a stale or replayed VP before any
// credential check. The token is signed before the conditional write, so a
// signing failure leaves the exchange unchanged. Freshness is checked again
// after signing, so a VP that ages out during the checks is refused. The
// conditional write makes the rule hold when authentications race.
const authenticate = async (exchangeId, { vp, jwtVp }, context) => {
  const { repos } = context;
  const vpClaims = replayClaimsOf(jwtVp);
  assertVpIsFresh(vpClaims, context);
  await assertVpCanAuthenticate(exchangeId, vpClaims, context);
  const exchange = await repos.exchanges.addState(
    exchangeId,
    ExchangeStates.AUTHENTICATION_REQUEST,
    {
      disclosureConsentedAt: new Date(),
    },
  );
  const issuerService = await repos.issuerServices.findOne({
    filter: { _id: exchange.serviceId },
  });

  validateReferencedService(issuerService);
  const authHandler = selectAuthHandler(issuerService, vp);
  const depot = await authHandler(
    { vp, jwtVp, exchange, issuerService },
    context,
  );

  const token = await generateAccessToken(
    issuerService,
    { _id: exchange._id, depotId: depot._id },
    context,
  );
  assertVpIsFresh(vpClaims, context);
  const authenticatedExchange = await repos.exchanges.addStateUsingFilter(
    authenticationFilter(exchangeId, depot, vpClaims.jti),
    ExchangeStates.AUTHENTICATION_SUCCESS,
    { depotId: depot._id },
    undefined,
    vpClaims.jti == null ? undefined : { authenticatedJtis: vpClaims.jti },
  );
  if (authenticatedExchange == null) {
    throw authenticationRefusedError(
      'the VP has authenticated the exchange already, or for another depot',
      context,
    );
  }

  return { exchange: authenticatedExchange, token };
};

const replayClaimsOf = (jwtVp) => {
  const { payload } = jwtDecode(jwtVp);
  return {
    jti: isString(payload.jti) && !isEmpty(payload.jti) ? payload.jti : null,
    iat: payload.iat,
  };
};

const assertVpIsFresh = ({ iat }, context) => {
  const now = Date.now() / 1000;
  if (
    !Number.isFinite(iat) ||
    now - iat > MAX_VP_AGE_SECONDS ||
    iat - now > MAX_VP_FUTURE_SECONDS
  ) {
    throw authenticationRefusedError(
      "the VP's iat is missing or too far from now",
      context,
    );
  }
};

// Refuses a VP that has already authenticated the exchange, and a VP without a
// jti once the exchange has authenticated. A completed exchange is left to
// addState, which reports it as not found.
const assertVpCanAuthenticate = async (exchangeId, { jti }, context) => {
  const exchange = await context.repos.exchanges.findOne(
    {
      filter: {
        _id: exchangeId,
        'events.state': { $ne: ExchangeStates.COMPLETE },
      },
    },
    { _id: 1, events: 1, authenticatedJtis: 1 },
  );
  if (!hasAuthenticated(exchange)) {
    return;
  }
  if (jti == null || includes(jti, exchange.authenticatedJtis)) {
    throw authenticationRefusedError(
      'the VP has no jti or has authenticated the exchange already',
      context,
    );
  }
};

const hasAuthenticated = (exchange) =>
  some({ state: ExchangeStates.AUTHENTICATION_SUCCESS }, exchange?.events);

// The exchange isn't complete, the VP's jti hasn't authenticated it, and it's
// bound to no depot or to this one. Without a jti, it mustn't have
// authenticated at all.
const authenticationFilter = (exchangeId, depot, jti) => ({
  _id: exchangeId,
  $or: [{ depotId: null }, { depotId: new ObjectId(depot._id) }],
  ...(jti == null
    ? {
        'events.state': {
          $nin: [
            ExchangeStates.AUTHENTICATION_SUCCESS,
            ExchangeStates.COMPLETE,
          ],
        },
      }
    : {
        'events.state': { $ne: ExchangeStates.COMPLETE },
        authenticatedJtis: { $ne: jti },
      }),
});

const authenticationRefusedError = (reason, { log }) => {
  log.warn({ reason }, 'wallet authentication refused');
  return newError(401, ExchangeErrors.UNAUTHORIZED, {
    errorCode: ExchangeErrors.UNAUTHORIZED,
  });
};

// A per-depot preauth link carries a vendorOriginContext and a shared link
// doesn't, so a service with both methods supports both kinds of link. A
// preauth-only service keeps its 401 for a missing code.
const selectAuthHandler = (issuerService, vp) => {
  if (
    isPreauthCodeAuth(issuerService) &&
    (vp.vendorOriginContext != null || !isInternalVpAuth(issuerService))
  ) {
    return preauthCodeAuthHandler;
  }
  if (canUseVpAuth(issuerService)) {
    return vpAuthHandler;
  }
  throw newError(400, ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED, {
    errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
  });
};

// VP auth checks the disclosureRequest. The manifest asks for a configured
// presentationDefinition in its place, whose constraints aren't enforced, so
// a service stored with one before create and update refused it can't use
// VP auth.
const canUseVpAuth = (issuerService) =>
  isInternalVpAuth(issuerService) &&
  issuerService.presentationDefinition == null;

const preauthCodeAuthHandler = async ({ vp }, context) => {
  const { repos } = context;
  const preauthCodeParts = split(':', vp.vendorOriginContext);
  const depot = await repos.depots.findOne({
    filter: { _id: preauthCodeParts?.[1] },
  });
  validatePreauth(preauthCodeParts?.[2], depot, context);
  return depot;
};

const vpAuthHandler = async (
  { vp, jwtVp, exchange, issuerService },
  context,
) => {
  const holderDid = verifyHolderDid(jwtVp, context);
  validatePresentation(vp, exchange, context);
  const requestedTypes = requestedTypesOf(issuerService);
  const jwtVcs = selectRequestedCredentials(vp, requestedTypes);
  const checkResults = await checkPresentedCredentials(
    jwtVcs,
    holderDid,
    context,
  );
  assertCredentialChecksPassed(checkResults, jwtVcs, context);
  const verifiedCredentials = map(
    ({ credential }) => ({
      type: extractCredentialType(credential),
      credential,
    }),
    checkResults,
  );
  assertEveryTypePresented(verifiedCredentials, requestedTypes, context);
  return findAuthenticatedDepot(
    verifiedCredentials,
    exchange,
    issuerService,
    context,
  );
};

// The controller verified the VP's signature with the key that its kid names,
// so the holder is the DID part of the kid. The VP's iss must be that DID.
const verifyHolderDid = (jwtVp, { log }) => {
  const { header, payload } = jwtDecode(jwtVp);
  const holderDid = first(split('#', header.kid));
  if (isEmpty(holderDid) || payload.iss !== holderDid) {
    log.warn('vp auth: the VP iss is missing or is not the DID of its kid');
    throw newError(401, ExchangeErrors.UNAUTHORIZED, {
      errorCode: ExchangeErrors.UNAUTHORIZED,
    });
  }
  return holderDid;
};

const requestedTypesOf = (issuerService) =>
  flow(map('type'), filter(isString))(issuerService.disclosureRequest?.types);

// Only credentials of the requested types are checked and matched.
const selectRequestedCredentials = (vp, requestedTypes) => {
  const jwtVcs = vp.verifiableCredential;
  if (!isCompactCredentialList(jwtVcs)) {
    throw newError(
      400,
      `verifiableCredential must be an array of at most ${MAX_PRESENTED_CREDENTIALS} compact credentials`,
      { errorCode: 'presentation_invalid' },
    );
  }
  const requestedJwtVcs = filter(
    (jwtVc) => includes(credentialTypeOf(jwtVc), requestedTypes),
    jwtVcs,
  );
  if (isEmpty(requestedJwtVcs)) {
    throw identificationUserNotFoundError();
  }
  return requestedJwtVcs;
};

const isCompactCredentialList = (jwtVcs) =>
  isArray(jwtVcs) &&
  size(jwtVcs) <= MAX_PRESENTED_CREDENTIALS &&
  every(isString, jwtVcs);

// The type is read before verification. Verification recomputes it from the
// verified credential, so a credential with a tampered type fails the checks.
const credentialTypeOf = (jwtVc) => {
  try {
    return extractCredentialType(decodeCredentialEnvelope(jwtVc).credential);
  } catch {
    return undefined;
  }
};

// verifyCredentials throws a TypeError when its input checks reject a
// credential, such as a protected header whose kid isn't a string.
const checkPresentedCredentials = async (jwtVcs, holderDid, context) => {
  try {
    return await checkCredentials(jwtVcs, holderDid, context);
  } catch (error) {
    if (error instanceof TypeError) {
      context.log.warn(
        { message: error.message },
        'vp auth: a presented credential is malformed',
      );
      throw newError(400, 'A presented credential is malformed', {
        errorCode: 'presentation_invalid',
      });
    }
    throw error;
  }
};

// verifyCredentials returns one result per credential, in order.
const assertCredentialChecksPassed = (checkResults, jwtVcs, context) => {
  const credentialChecks = map('credentialChecks', checkResults);
  if (some(isVoucherReserveExhausted, credentialChecks)) {
    throw newError(402, 'Verification vouchers exhausted', {
      errorCode: 'verification_payment_required',
    });
  }
  if (some(isDependencyUnavailable, credentialChecks)) {
    throw newError(502, ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE, {
      errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
    });
  }
  for (const [checkResult, jwtVc] of zip(checkResults, jwtVcs)) {
    const error = failedCheckError(checkResult, jwtVc, context);
    if (error != null) {
      throw error;
    }
  }
};

const isVoucherReserveExhausted = flow(
  values,
  includes(CheckResults.VOUCHER_RESERVE_EXHAUSTED),
);

const isDependencyUnavailable = flow(
  pick(DEPENDENCY_CHECKS),
  values,
  includes(CheckResults.DEPENDENCY_RESOLUTION_ERROR),
);

const failedCheckError = (checkResult, jwtVc, context) =>
  buildFailedCheckResultError(checkResult, context) ??
  unboundHolderError(checkResult, context) ??
  multipleSubjectsError(jwtVc, context);

// buildFailedCheckResultError accepts a TRUSTED_HOLDER of NOT_APPLICABLE,
// which a credential without holder binding gets. Authentication doesn't.
const unboundHolderError = ({ credentialChecks }, { log }) => {
  if (credentialChecks.TRUSTED_HOLDER === CheckResults.PASS) {
    return undefined;
  }
  log.error(
    { trustedHolderCheck: credentialChecks.TRUSTED_HOLDER },
    'vp auth: the credential is not bound to the holder',
  );
  return newError(401, 'presentation_credential_bad_holder', {
    errorCode: 'presentation_credential_bad_holder',
  });
};

// The holder check passes when the holder is any one of a credential's
// subjects, while rules read the whole credential. So a credential must have
// exactly one subject: an object, or an array of exactly one object. This is
// decided from the subject as the signed credential carries it. Decoding a
// VC 1.1 JWT merges an array of subjects into one object and adds the JWT's
// sub as its id, which would hide the other subjects.
const multipleSubjectsError = (jwtVc, { log }) => {
  if (hasSingleSubject(rawCredentialSubjectOf(jwtVc))) {
    return undefined;
  }
  log.error('vp auth: the credential does not have exactly one subject');
  return newError(401, 'presentation_credential_bad_holder', {
    errorCode: 'presentation_credential_bad_holder',
  });
};

const rawCredentialSubjectOf = (jwtVc) => {
  const { payload } = jwtDecode(jwtVc);
  return decodeCredentialEnvelope(jwtVc).dataModelVersion ===
    CredentialDataModelVersions.V1_1
    ? payload.vc?.credentialSubject
    : payload.credentialSubject;
};

const hasSingleSubject = (credentialSubject) =>
  isPlainObject(credentialSubject) ||
  (isArray(credentialSubject) &&
    size(credentialSubject) === 1 &&
    isPlainObject(credentialSubject[0]));

// Every requested type needs a verified credential, as the manifest's "all"
// submission requirement asks. Types are read from the verified credentials.
const assertEveryTypePresented = (
  verifiedCredentials,
  requestedTypes,
  { log },
) => {
  const missingTypes = difference(
    requestedTypes,
    map('type', verifiedCredentials),
  );
  if (!isEmpty(missingTypes)) {
    log.info(
      { missingTypes },
      'vp auth: no verified credential of a requested type',
    );
    throw identificationUserNotFoundError();
  }
};

// Each rule reads only the verified credentials of its type. A depot is found
// only when its authMatchValues equal a candidate tuple exactly, and it was
// created under the service's current auth rules. Only depot ids and counts
// are logged, never the values.
const findAuthenticatedDepot = async (
  credentials,
  exchange,
  issuerService,
  context,
) => {
  const { repos } = context;
  const tuples = buildCandidateTuples(
    issuerService.verifiablePresentationAuthRules,
    credentials,
  );
  const depots = isEmpty(tuples)
    ? []
    : await repos.depots.findDepotsByAuthMatchTuples(
        exchange.serviceId,
        buildAuthRulesFingerprint(issuerService),
        tuples,
      );
  if (size(depots) === 1) {
    return first(depots);
  }
  logUnmatched(depots, tuples, exchange, context);
  throw identificationUserNotFoundError();
};

const logUnmatched = (depots, tuples, exchange, { log }) => {
  const logContext = {
    exchangeId: exchange._id,
    serviceId: exchange.serviceId,
  };
  if (isEmpty(depots)) {
    log.info(
      { ...logContext, candidateCount: size(tuples) },
      'vp auth: no depot matches the presented credentials',
    );
    return;
  }
  log.warn(
    { ...logContext, depotIds: map('_id', depots) },
    'vp auth: more than one depot matches the presented credentials',
  );
};

const identificationUserNotFoundError = () =>
  newError(401, ExchangeErrors.IDENTIFICATION_USER_NOT_FOUND, {
    errorCode: ExchangeErrors.IDENTIFICATION_USER_NOT_FOUND,
  });

module.exports = { authenticate };
