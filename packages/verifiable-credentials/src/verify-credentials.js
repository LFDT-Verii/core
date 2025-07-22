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
  partition,
  reduce,
  size,
  some,
  startsWith,
  toLower,
  uniq,
} = require('lodash/fp');
const {
  buildDecodedCredential,
  jwtDecode,
  hexFromJwk,
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
  checkJwtVCTampering,
  checkCredentialStatus,
  checkIssuerTrust,
  checkHolder,
  extractCredentialType,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { mapWithIndex } = require('@verii/common-functions');
const {
  resolveDidJwkDocument,
  toDidUrl,
} = require('@verii/did-doc');
const { loadJsonldContext } = require('./load-jsonld-context');

const verifyCredentials = async (
  { credentials: jwtVcs, expectedHolderDid, relyingParty },
  fetchers,
  context
) => {
  const credentialDataList = mapWithIndex(buildCredentialDataFromJwtVc, jwtVcs);

  const [keyRefs, issuerRefs, credentialStatusRefs] = await Promise.all([
    resolveKeyRefs(credentialDataList, relyingParty, context),
    resolveIssuerMetadata(credentialDataList, fetchers, context),
    resolveCredentialStatuses(credentialDataList, context),
  ]);

  return Promise.all(
    map(async (data) => {
      const tamperingCheck = await runTamperingCheck(data, keyRefs, context);
      if (tamperingCheck !== CheckResults.PASS) {
        return {
          credentialChecks: tamperErrorCheckResults(tamperingCheck),
          credential: data.credential,
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
          context
        ),
        TRUSTED_HOLDER: checkHolder(
          data.credential,
          expectedHolderDid,
          context
        ),
        UNREVOKED: runCredentialStatusCheck(data, credentialStatusRefs),
        UNEXPIRED: checkExpiration(data.credential),
      };

      return { credentialChecks, credential: data.credential };
    }, credentialDataList)
  );
};

const buildCredentialDataFromJwtVc = (jwtVc, index) => {
  const { header, payload } = jwtDecode(jwtVc);
  return {
    id: payload.jti,
    index,
    credentialType: extractCredentialType(payload.vc),
    contentHash: payload.vc.contentHash?.value,
    issuerId: payload.iss,
    keyMetadata: header,
    jwtVc,
    credential: buildDecodedCredential(payload),
  };
};

const isIssuerTheSubject = (header) => !isDidVelocityCredential(header);
const isDidVelocityCredential = ({ kid }) => startsWith('did:velocity:', kid);

const resolveKeyRefs = async (credentialDataList, relyingParty, context) => {
  const [velocityCredentialDataList, otherCredentialDataList] = flow(
    filter(({ keyMetadata }) => keyMetadata.kid != null),
    partition(({ keyMetadata }) => isDidVelocityCredential(keyMetadata))
  )(credentialDataList);

  const resolutions = await Promise.all([
    resolveVelocityDidDocument(
      velocityCredentialDataList,
      relyingParty,
      context
    ),
    ...map(
      (credentialData) => resolveOtherDidDocument(credentialData, context),
      otherCredentialDataList
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
    resolutions
  );

  const boundIssuerVcsMap = keyBy(
    ({ id }) => toLower(id),
    first(resolutions)?.didDocumentMetadata?.boundIssuerVcs
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
  context
) => {
  if (isEmpty(credentialData)) {
    return {};
  }
  const { config, kms, rpcProvider, log } = context;

  // eslint-disable-next-line prefer-destructuring
  let dltPrivateKey = relyingParty.dltPrivateKey;
  if (dltPrivateKey == null) {
    const { privateJwk: dltJwk } = await kms.exportKeyOrSecret(
      relyingParty.dltOperatorKMSKeyId
    );
    dltPrivateKey = hexFromJwk(dltJwk);
  }

  const metadataRegistry = await initMetadataRegistry(
    {
      contractAddress: config.metadataRegistryContractAddress,
      privateKey: dltPrivateKey,
      rpcProvider,
    },
    context
  );
  const verificationCoupon = await initVerificationCoupon(
    {
      contractAddress: config.couponContractAddress,
      privateKey: dltPrivateKey,
      rpcProvider,
    },
    context
  );
  try {
    const multiDid = `did:velocity:v2:multi:${flow(
      map(({ id }) => id.split(':v2:')[1]),
      join(';')
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
      'did:velocity doc resolved'
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
  } catch (err) {
    log.error({ keyMetadata }, 'did method not supported');
    return { errors: { keyResolutionError: true } };
  }
};

const resolveIssuerMetadata = async (credentialData, fetchers, context) => {
  try {
    const issuerIds = flow(map('issuerId'), uniq)(credentialData);
    const credentialTypes = flow(map('credentialType'), uniq)(credentialData);

    const [
      accreditationVCs,
      issuerDidDocuments,
      rootJsonLdContexts,
      credentialSubjectJsonLdContexts,
      credentialTypeMetadatas,
    ] = await Promise.all([
      Promise.all(
        map(
          (issuerId) =>
            fetchers.getOrganizationVerifiedProfile(issuerId, context),
          issuerIds
        )
      ),
      Promise.all(
        map((issuerId) => fetchers.resolveDid(issuerId, context), issuerIds)
      ),
      Promise.all(
        map(
          ({ credential }) => loadJsonldContext(credential, context),
          credentialData
        )
      ),
      Promise.all(
        map(
          ({ credential }) =>
            loadJsonldContext(credential.credentialSubject, context),
          credentialData
        )
      ),
      fetchers.getCredentialTypeMetadata(credentialTypes, context),
    ]);

    return {
      accreditationVCMap: keyBy('credentialSubject.id', accreditationVCs),
      issuerDidDocumentMap: keyBy('id', issuerDidDocuments),
      credentialTypeMetadatasMap: keyBy(
        'credentialType',
        credentialTypeMetadatas
      ),
      jsonLdContexts: mapWithIndex(
        ({ credential }, i) =>
          rootJsonLdContexts[i]?.['@context']?.[
            credential?.credentialSubject?.type
          ] != null
            ? rootJsonLdContexts[i]
            : credentialSubjectJsonLdContexts[i],
        credentialData
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
    const credentialStatuses = await Promise.all(
      map(
        ({ credential }) =>
          resolveCredentialStatus(credential.credentialStatus),
        credentialData
      )
    );
    return { credentialStatuses };
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
    context
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

const runTamperingCheck = (
  { jwtVc, keyMetadata },
  { keyMap, errors },
  context
) => {
  if (errors?.vouchersExhausted) {
    return CheckResults.VOUCHER_RESERVE_EXHAUSTED;
  }
  if (errors?.keyResolutionError) {
    return CheckResults.DEPENDENCY_RESOLUTION_ERROR;
  }

  let key = keyMap[toLower(keyMetadata.kid)]?.publicKeyJwk;
  if (key == null && isIssuerTheSubject(keyMetadata)) {
    key = keyMetadata.jwk;
  }
  return checkJwtVCTampering(jwtVc, key, context);
};

const runIssuerTrustCheck = (
  { id, keyMetadata, issuerId, credentialType, index, credential },
  {
    boundIssuerVcsMap,
    accreditationVCMap,
    issuerDidDocumentMap,
    credentialTypeMetadatasMap,
    jsonLdContexts,
    errors,
  },
  context
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
      'runIssuerTrustCheck: resolvedDeps failed'
    );
    return Promise.resolve(CheckResults.FAIL);
  }

  return checkIssuerTrust(
    credential,
    issuerId,
    {
      ...resolvedDeps,
      jsonLdContext: jsonLdContexts[index],
    },
    context
  );
};

const runCredentialStatusCheck = ({ index }, { credentialStatuses, errors }) =>
  errors?.credentialStatusRetrievalError
    ? CheckResults.DEPENDENCY_RESOLUTION_ERROR
    : checkCredentialStatus(credentialStatuses[index]);

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
