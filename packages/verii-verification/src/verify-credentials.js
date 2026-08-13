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
const {
  filter,
  find,
  first,
  flow,
  isArray,
  isEmpty,
  join,
  keyBy,
  map,
  omit,
  partition,
  reduce,
  size,
  some,
  startsWith,
  toLower,
  uniq,
} = require('lodash/fp');
const {
  CredentialDataModelVersions,
  decodeCredentialEnvelope,
  getCredentialId,
  getCredentialIssuer,
  isCredentialVerificationAccepted,
  verifyCredentialEnvelope,
} = require('@verii/jwt');
const {
  initMetadataRegistry,
  initVerificationCoupon,
  initRevocationRegistry,
} = require('@verii/metadata-registration');
const {
  CheckResults,
  CredentialStatus,
  checkExpiration,
  checkValidity,
  checkCredentialStatus,
  checkIssuerTrust,
  checkHolder,
  extractCredentialType,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { mapWithIndex } = require('@verii/common-functions');
const { resolveDidJwkDocument, toDidUrl } = require('@verii/did-doc');

const MAX_CREDENTIALS_PER_VERIFICATION = 100;
const MAX_ROUTING_IDENTIFIER_CHARACTERS = 2048;

const verifyCredentials = async (
  { credentials: jwtVcs, expectedHolderDid, relyingParty },
  fetchers,
  context,
) => {
  assertCredentialBatch(jwtVcs);
  const credentialDataList = mapWithIndex(buildCredentialDataFromJwtVc, jwtVcs);

  const keyRefs = await resolveKeyRefs(
    credentialDataList,
    relyingParty,
    context,
  );
  const verifiedCredentialDataList = await Promise.all(
    map(
      (data) => verifyCredentialData(data, keyRefs, context),
      credentialDataList,
    ),
  );
  const trustedCredentialDataList = filter(
    ({ tamperingCheck }) => tamperingCheck === CheckResults.PASS,
    verifiedCredentialDataList,
  );
  const [issuerRefs, credentialStatusRefs] = isEmpty(trustedCredentialDataList)
    ? [emptyIssuerRefs(), emptyCredentialStatusRefs()]
    : await Promise.all([
        resolveIssuerMetadata(trustedCredentialDataList, fetchers, context),
        resolveCredentialStatuses(trustedCredentialDataList, context),
      ]);

  return Promise.all(
    map(async (data) => {
      if (data.tamperingCheck !== CheckResults.PASS) {
        return {
          credentialChecks: tamperErrorCheckResults(data.tamperingCheck),
          ...(Object.hasOwn(data, 'credential')
            ? { credential: data.credential }
            : {}),
          ...buildFormatMetadata(data),
        };
      }

      const credentialChecks = {
        UNTAMPERED: CheckResults.PASS,
        TRUSTED_ISSUER: await runIssuerTrustCheck(
          data,
          {
            boundIssuerVcsMap: keyRefs.boundIssuerVcsMap,
            ...issuerRefs,
          },
          context,
        ),
        TRUSTED_HOLDER: checkHolder(
          data.dataModelVersion,
          data.credential,
          expectedHolderDid,
          context,
        ),
        UNREVOKED: runCredentialStatusCheck(data, credentialStatusRefs),
        UNEXPIRED: runValidityCheck(data),
      };

      return {
        credentialChecks,
        credential: data.credential,
        ...buildFormatMetadata(data),
      };
    }, verifiedCredentialDataList),
  );
};

const buildCredentialDataFromJwtVc = (jwtVc, index) => {
  const envelope = decodeCredentialEnvelope(jwtVc);
  const { credential, protectedHeader } = envelope;
  const issuer = getCredentialIssuer(envelope);
  assertRoutingIdentifier(credential.id, 'credential id');
  assertRoutingIdentifier(protectedHeader.kid, 'kid');
  return {
    ...envelope,
    id: getCredentialId(envelope),
    index,
    credentialType: extractCredentialType(credential),
    contentHash: credential.contentHash?.value,
    issuerId: issuer?.id ?? issuer,
    keyMetadata: protectedHeader,
    jwtVc,
  };
};

const assertRoutingIdentifier = (value, name) => {
  if (
    value != null &&
    (typeof value !== 'string' ||
      value.length === 0 ||
      value.length > MAX_ROUTING_IDENTIFIER_CHARACTERS)
  ) {
    throw new TypeError(
      `credential ${name} must be a bounded non-empty string when present`,
    );
  }
};

const buildFormatMetadata = ({
  conformance,
  dataModelVersion,
  envelopeFormat,
  policy,
  proof,
  signingAlgorithm,
}) => ({
  dataModelVersion,
  envelopeFormat,
  ...(dataModelVersion === CredentialDataModelVersions.V2_0 && proof != null
    ? { conformance, policy, proof }
    : {}),
  signingAlgorithm,
});

const emptyCredentialStatusRefs = () => ({ credentialStatusesMap: {} });

const emptyIssuerRefs = () => ({
  accreditationVCMap: {},
  credentialTypeMetadatasMap: {},
  issuerDidDocumentMap: {},
});

const assertCredentialBatch = (jwtVcs) => {
  if (
    !Array.isArray(jwtVcs) ||
    jwtVcs.length > MAX_CREDENTIALS_PER_VERIFICATION
  ) {
    throw new TypeError(
      `credentials must contain at most ${MAX_CREDENTIALS_PER_VERIFICATION} compact credentials`,
    );
  }
};

const isIssuerTheSubject = (header) => !isDidVelocityCredential(header);
const isDidVelocityCredential = ({ kid }) => startsWith('did:velocity:', kid);

const resolveKeyRefs = async (credentialDataList, relyingParty, context) => {
  const [velocityCredentialDataList, otherCredentialDataList] = flow(
    filter(({ keyMetadata }) => keyMetadata.kid != null),
    partition(({ keyMetadata }) => isDidVelocityCredential(keyMetadata)),
  )(credentialDataList);

  const resolutions = await Promise.all([
    resolveVelocityDidDocument(
      velocityCredentialDataList,
      relyingParty,
      context,
    ),
    ...map(
      (credentialData) => resolveOtherDidDocument(credentialData, context),
      otherCredentialDataList,
    ),
  ]);

  const keyMap = reduce(
    (acc, { didDocument }) => {
      const keys =
        didDocument?.verificationMethod ?? didDocument?.publicKey ?? [];
      for (const key of keys) {
        acc[toLower(toDidUrl(didDocument.id, key.id))] = key;
      }
      return acc;
    },
    {},
    resolutions,
  );

  const boundIssuerVcsMap = keyBy(
    ({ id }) => toLower(id),
    first(resolutions)?.didDocumentMetadata?.boundIssuerVcs,
  );

  return {
    keyMap,
    boundIssuerVcsMap,
    errors: flow(map('errors'), find(size))(resolutions),
  };
};

const resolveVelocityDidDocument = async (
  credentialData,
  relyingParty,
  context,
) => {
  if (isEmpty(credentialData)) {
    return {};
  }
  const { config, kms, rpcProvider, log } = context;

  // eslint-disable-next-line prefer-destructuring
  let dltPrivateKey = relyingParty.dltPrivateKey;
  if (dltPrivateKey == null) {
    const { privateJwk: dltJwk } = await kms.exportKeyOrSecret(
      relyingParty.dltOperatorKMSKeyId,
    );
    dltPrivateKey = dltJwk;
  }

  const metadataRegistry = await initMetadataRegistry(
    {
      contractAddress: config.metadataRegistryContractAddress,
      privateKey: dltPrivateKey,
      rpcProvider,
    },
    context,
  );
  const verificationCoupon = await initVerificationCoupon(
    {
      contractAddress: config.couponContractAddress,
      privateKey: dltPrivateKey,
      rpcProvider,
    },
    context,
  );
  try {
    const multiDid = `did:velocity:v2:multi:${flow(
      map(({ keyMetadata }) => keyMetadata.kid.split('#')[0].split(':v2:')[1]),
      join(';'),
    )(credentialData)}`;

    const { didDocument, didDocumentMetadata, didResolutionMetadata } =
      await metadataRegistry.resolveDidDocument({
        did: multiDid,
        verificationCoupon,
        credentials: credentialData,
        burnerDid: context.tenant.did,
        caoDid: context.caoDid,
      });

    log.info(
      { didDocument, didDocumentMetadata, didResolutionMetadata },
      'did:velocity doc resolved',
    );

    return { didDocument, didDocumentMetadata };
  } catch (err) {
    if (err.reason === 'No available tokens') {
      log.warn({ err });
      return { errors: { vouchersExhausted: true } };
    }
    log.error({ err });
    return { errors: { keyResolutionError: true } };
  }
};

const resolveOtherDidDocument = async ({ keyMetadata }, { log }) => {
  try {
    const didDocument = await resolveDidJwkDocument(keyMetadata.kid);
    return { didDocument };
  } catch {
    log.error({ keyMetadata }, 'did method not supported');
    return { errors: { keyResolutionError: true } };
  }
};

const resolveIssuerMetadata = async (credentialData, fetchers, context) => {
  try {
    const issuerIds = flow(map('issuerId'), uniq)(credentialData);
    const credentialTypes = flow(map('credentialType'), uniq)(credentialData);

    const [accreditationVCs, issuerDidDocuments, credentialTypeMetadatas] =
      await Promise.all([
        Promise.all(
          map(
            (issuerId) =>
              fetchers
                .getOrganizationVerifiedProfile(issuerId, context)
                .catch(() => {}),
            issuerIds,
          ),
        ),
        Promise.all(
          map(
            (issuerId) =>
              fetchers.resolveDid(issuerId, context).catch(() => {}),
            issuerIds,
          ),
        ),
        fetchers.getCredentialTypeMetadata(credentialTypes, context),
      ]);

    return {
      accreditationVCMap: keyBy('credentialSubject.id', accreditationVCs),
      issuerDidDocumentMap: keyBy('id', issuerDidDocuments),
      credentialTypeMetadatasMap: keyBy(
        'credentialType',
        credentialTypeMetadatas,
      ),
    };
  } catch (error) {
    context.log.error(error);
    return { errors: { metadataRetrievalError: true } };
  }
};

const resolveCredentialStatuses = async (credentialData, context) => {
  try {
    const resolveCredentialStatus = await initResolveCredentialStatus(context);
    const resolvedStatuses = await Promise.all(
      map(
        async ({ credential, index }) => ({
          index,
          status: await resolveCredentialStatus(credential.credentialStatus),
        }),
        credentialData,
      ),
    );
    return { credentialStatusesMap: keyBy('index', resolvedStatuses) };
  } catch {
    return { errors: { credentialStatusRetrievalError: true } };
  }
};

const initResolveCredentialStatus = async (context) => {
  const {
    config: { revocationContractAddress },
    rpcProvider,
    log,
  } = context;

  const { getRevokedStatus } = await initRevocationRegistry(
    { contractAddress: revocationContractAddress, rpcProvider },
    context,
  );

  return async (credentialStatusEntries) => {
    const status = getVelocityCredentialStatus(credentialStatusEntries);
    if (status?.id == null) {
      return CredentialStatus.NOT_SUPPORTED;
    }

    try {
      const revokedStatus = await getRevokedStatus(status.id);
      return revokedStatus
        ? CredentialStatus.REVOKED
        : CredentialStatus.UNREVOKED;
    } catch (err) {
      log.error(err);
      return CredentialStatus.DEPENDENCY_RESOLUTION_ERROR;
    }
  };
};

const verifyCredentialData = async (data, { keyMap, errors }, context) => {
  const resolutionFailure = resolutionFailureFrom(errors);
  if (resolutionFailure != null) {
    return failedCredentialData(data, resolutionFailure);
  }

  const verificationKey = getVerificationKey(data, keyMap);
  if (verificationKey == null) {
    return failedCredentialData(data, CheckResults.DATA_INTEGRITY_ERROR);
  }

  try {
    const verifiedEnvelope = await verifyCredentialEnvelope(
      data.jwtVc,
      verificationKey,
    );
    if (!isCredentialVerificationAccepted(verifiedEnvelope)) {
      context.log.error(
        {
          credentialId: data.id,
          conformance: verifiedEnvelope.conformance,
          policy: verifiedEnvelope.policy,
          proof: verifiedEnvelope.proof,
        },
        'credential verification failed',
      );
      return failedCredentialData(
        { ...data, ...verifiedEnvelope },
        CheckResults.FAIL,
      );
    }
    return {
      ...data,
      ...verifiedEnvelope,
      credentialType: extractCredentialType(verifiedEnvelope.credential),
      id: getCredentialId(verifiedEnvelope),
      issuerId: issuerIdFrom(verifiedEnvelope.credential.issuer),
      tamperingCheck: CheckResults.PASS,
    };
  } catch (error) {
    context.log.error(
      {
        credentialId: data.id,
        errorCode: error.code,
      },
      `credential verification failed: ${error.message}`,
    );
    return failedCredentialData(data, CheckResults.FAIL);
  }
};

const failedCredentialData = (data, tamperingCheck) => ({
  ...(data.dataModelVersion === CredentialDataModelVersions.V2_0
    ? omit(['credential'], data)
    : data),
  signingAlgorithm: data.protectedHeader.alg,
  tamperingCheck,
});

const resolutionFailureFrom = (errors) => {
  if (errors?.vouchersExhausted) {
    return CheckResults.VOUCHER_RESERVE_EXHAUSTED;
  }
  return errors?.keyResolutionError
    ? CheckResults.DEPENDENCY_RESOLUTION_ERROR
    : null;
};

const getVerificationKey = ({ keyMetadata }, keyMap) => {
  if (keyMetadata.kid != null) {
    return keyMap[toLower(keyMetadata.kid)]?.publicKeyJwk;
  }
  return isIssuerTheSubject(keyMetadata) ? keyMetadata.jwk : null;
};

const issuerIdFrom = (issuer) => issuer?.id ?? issuer;

const runIssuerTrustCheck = (
  { id, keyMetadata, issuerId, credentialType, credential },
  {
    boundIssuerVcsMap,
    accreditationVCMap,
    issuerDidDocumentMap,
    credentialTypeMetadatasMap,
    errors,
  },
  context,
  // eslint-disable-next-line complexity
) => {
  const { log } = context;
  if (errors?.metadataRetrievalError) {
    return Promise.resolve(CheckResults.DEPENDENCY_RESOLUTION_ERROR);
  }

  if (isIssuerTheSubject(keyMetadata)) {
    return Promise.resolve(CheckResults.SELF_SIGNED);
  }

  const resolvedDeps = {
    boundIssuerVc: boundIssuerVcsMap[toLower(id)]?.vc,
    issuerAccreditation: accreditationVCMap[issuerId]?.credentialSubject,
    issuerDidDocument: issuerDidDocumentMap[issuerId],
    credentialTypeMetadata: credentialTypeMetadatasMap[credentialType],
  };

  if (some(isEmpty, Object.values(resolvedDeps))) {
    log.error(
      { id, credential, issuerId, credentialType, resolvedDeps },
      'runIssuerTrustCheck: resolvedDeps failed',
    );
    return Promise.resolve(CheckResults.FAIL);
  }

  return checkIssuerTrust(credential, issuerId, resolvedDeps, context);
};

const runCredentialStatusCheck = (
  { index },
  { credentialStatusesMap, errors },
) =>
  errors?.credentialStatusRetrievalError
    ? CheckResults.DEPENDENCY_RESOLUTION_ERROR
    : checkCredentialStatus(credentialStatusesMap[index]?.status);

const runValidityCheck = ({ credential, dataModelVersion }) =>
  dataModelVersion === CredentialDataModelVersions.V1_1
    ? checkExpiration(credential)
    : checkValidity(credential);

const getVelocityCredentialStatus = (credentialStatus) => {
  if (isArray(credentialStatus)) {
    return find({ type: VelocityRevocationListType }, credentialStatus);
  }

  if (credentialStatus?.type !== VelocityRevocationListType) {
    return null;
  }
  return credentialStatus;
};

const tamperErrorCheckResults = (checkStatus) => ({
  UNTAMPERED: checkStatus,
  TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
  TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
  UNREVOKED: CheckResults.NOT_CHECKED,
  UNEXPIRED: CheckResults.NOT_CHECKED,
});

module.exports = { verifyCredentials };
