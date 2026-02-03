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

const { mapWithIndex } = require('@verii/common-functions');
const {
  initContractClient,
  initContractWithTransactingClient,
} = require('@verii/base-contract-io');

const {
  get2BytesHash,
  deriveEncryptionSecretFromPassword,
} = require('@verii/crypto');
const {
  find,
  flow,
  isEmpty,
  join,
  last,
  map,
  partition,
} = require('lodash/fp');

const contractAbi = require('./contracts/metadata-registry.json');
const { RESOLUTION_METADATA_ERROR, VERSION, ALG_TYPE } = require('./constants');
const { encodeJwk, decodeJwk } = require('./code-jwk');

const initMetadataRegistry = async (
  { privateKey, contractAddress, rpcProvider },
  context,
) => {
  const { log } = context;
  log.info({ contractAddress }, 'initMetadataRegistry');

  const { contractClient, pullEvents } = await initContractClient(
    {
      privateKey,
      contractAddress,
      rpcProvider,
      contractAbi,
    },
    context,
  );

  // TODO this check should NOT require a contractClient call. All free types should be cached on startup, and reloaded every X (configurable) hours
  const isExistMetadataList = (id, accountId) => {
    log.info({ id, accountId }, 'isExistMetadataList');
    return contractClient.isExistMetadataList(accountId, id);
  };

  // TODO this check should NOT require a contractClient call. All free types should be cached on startup, and reloaded every X (configurable) hours
  const isFreeCredentialType = (credentialType) => {
    log.info({ credentialType }, 'isFreeCredentialType');
    return contractClient.isFreeCredentialType(get2BytesHash(credentialType));
  };

  const isFreeCredentialTypeList = async (freeCredentialTypesList) => {
    log.info({ freeCredentialTypesList }, 'isFreeCredentialTypeList');
    const checkList = await Promise.all(
      freeCredentialTypesList.map(isFreeCredentialType),
    );
    return checkList.every((check) => check);
  };

  const setEntrySigned = async (
    credentialType,
    encryptedPK,
    listId,
    index,
    caoDid,
  ) => {
    log.info(
      { credentialType, encryptedPK, listId, index, caoDid },
      'setEntrySigned',
    );
    const { transactingClient, signature } =
      await initContractWithTransactingClient(
        {
          privateKey,
          contractAddress,
          rpcProvider,
          contractAbi,
        },
        context,
      );
    const tx = await transactingClient.contractClient.setEntrySigned(
      credentialType,
      encryptedPK,
      listId,
      index,
      context.traceId,
      caoDid,
      signature,
    );
    const txResult = await tx.wait();
    log.info({ events: txResult.logs }, 'setEntrySigned Complete');
    return last(txResult.logs).args;
  };

  const getFreeEntries = async (indexEntries) => {
    log.info({ indexEntries }, 'getFreeEntries');
    return contractClient.getFreeEntries(indexEntries);
  };

  const getPaidEntriesSigned = async (
    indexEntries,
    traceId,
    caoDid,
    burnerDid,
  ) => {
    log.info(
      { indexEntries, traceId, caoDid, burnerDid },
      'getPaidEntriesSigned',
    );

    const { transactingClient, signature } =
      await initContractWithTransactingClient(
        {
          privateKey,
          contractAddress,
          rpcProvider,
          contractAbi,
        },
        context,
      );

    const tx = await transactingClient.contractClient.getPaidEntriesSigned(
      indexEntries,
      traceId,
      caoDid,
      burnerDid,
      signature,
    );
    const txResult = await tx.wait();
    return last(txResult.logs)?.args?.credentialMetadataList;
  };

  const createCredentialMetadataList = async (
    accountId,
    listId,
    issuerVC,
    caoDid,
    algType = ALG_TYPE.HEX_AES_256,
    version = VERSION,
  ) => {
    log.info(
      { listId, issuerVC, caoDid, algType, version },
      'createCredentialMetadataList',
    );
    const { transactingClient, signature } =
      await initContractWithTransactingClient(
        {
          privateKey,
          contractAddress,
          rpcProvider,
          contractAbi,
        },
        context,
      );

    try {
      const tx = await transactingClient.contractClient.newMetadataListSigned(
        listId,
        get2BytesHash(algType),
        get2BytesHash(version),
        `0x${Buffer.from(issuerVC).toString('hex')}`,
        context.traceId,
        caoDid,
        signature,
      );
      await tx.wait();
      return true;
    } catch (creationError) {
      if (!(await isExistMetadataList(listId, accountId))) {
        throw creationError;
      }
      return false;
    }
  };

  const addCredentialMetadataEntry = async (
    { listId, index, credentialTypeEncoded, publicKey },
    password,
    caoDid,
    algType = ALG_TYPE.HEX_AES_256,
  ) => {
    log.info(
      { listId, index, credentialTypeEncoded, caoDid, publicKey, algType },
      'addCredentialMetadataEntry',
    );
    const secret = await deriveEncryptionSecretFromPassword(password);
    const encryptedPK = await encodeJwk(algType, publicKey, secret);

    try {
      await setEntrySigned(
        credentialTypeEncoded,
        encryptedPK,
        listId,
        index,
        caoDid,
      );
      return true;
    } catch (e) {
      throw modifySetEntrySignedError(e);
    }
  };

  const modifySetEntrySignedError = (e) => {
    let errorCode;
    switch (e.reason) {
      case 'Permissions: primary of operator lacks credential:issue permission':
        errorCode = 'career_issuing_not_permitted';
        break;
      case 'Permissions: primary of operator lacks credential:identityissue permission':
        errorCode = 'identity_issuing_not_permitted';
        break;
      case 'Permissions: primary of operator lacks credential:contactissue permission':
        errorCode = 'contact_issuing_not_permitted';
        break;
      default:
        break;
    }
    // eslint-disable-next-line better-mutation/no-mutation
    e.errorCode = errorCode;
    return e;
  };
  const parseVelocityV2Did = (did) => {
    log.info({ did }, 'parseVelocityV2Did');
    if (!did.startsWith('did:velocity:v2:')) {
      throw new Error(`Wrong did ${did}`);
    }

    const multiToken = ':multi:';
    if (did.indexOf(multiToken) === -1) {
      return [parseSingleVelocityDid(did)];
    }

    const [, entriesPart] = did.split(multiToken);
    return map((entryString) => {
      const [accountId, listId, index, contentHash] = entryString.split(':');
      return { accountId, listId, index, contentHash };
    }, entriesPart.split(';'));
  };
  const parseSingleVelocityDid = (did) => {
    const [, , , accountId, listId, index, contentHash] = did.split(':');
    return { accountId, listId, index, contentHash };
  };

  const resolvePublicKey = async ({ id, entry, secret }) => {
    log.info({ id, entry, secret }, 'resolvePublicKey');
    const { algType, version } = entry;

    if (version !== get2BytesHash(VERSION)) {
      throw new Error(`Unsupported version "${version}"`);
    }
    if (!Object.values(ALG_TYPE).map(get2BytesHash).includes(algType)) {
      throw new Error(
        `Unsupported algorithm (${algType}). Valid values are ${flow(
          map((type) => `${type} (${get2BytesHash(type)})`),
          join(' or '),
        )(Object.values(ALG_TYPE))}`,
      );
    }

    const encryptedPublicKey = Buffer.from(
      entry.encryptedPublicKey.slice(2),
      'hex',
    );

    try {
      const publicKeyJwk = await decodeJwk(algType, encryptedPublicKey, secret);
      return {
        id: `${id}#key-1`,
        publicKeyJwk,
      };
    } catch (e) {
      log.error({ err: e }, 'resolvePublicKey: DECRYPTION FAIL');
      return {
        id,
      };
    }
  };

  const resolveService = ({ id, entry, credentialType }) => {
    log.info({ id, entry, credentialType }, 'resolveService');
    if (
      !credentialType ||
      entry.credentialType !== get2BytesHash(credentialType) // TODO - looks like credential types are stored incorrectly
    ) {
      throw new Error(`Invalid hash credentialType "${credentialType}"`);
    }
    return {
      id: `${id}#service`,
      credentialType,
    };
  };

  const resolveIssuerVc = ({ id, entry }) => {
    log.info({ id, entry }, 'resolveIssuerVc');
    return {
      id,
      format: 'jwt_vc',
      vc: Buffer.from(entry.issuerVc.slice(2), 'hex').toString(),
    };
  };

  const resolveContractEntries = async ({
    credentials,
    indexEntries,
    traceId,
    caoDid,
    burnerDid,
  }) => {
    log.info(
      { credentials, indexEntries, traceId, caoDid, burnerDid },
      'resolveContractEntries',
    );
    const isFree = await flow(
      map(({ id, credentialType }) => {
        if (!credentialType) {
          throw new Error(
            `Could not resolve credential type from VC with ${id}`,
          );
        }
        return credentialType;
      }),
      isFreeCredentialTypeList,
    )(credentials);
    if (isEmpty(indexEntries)) {
      return [];
    }
    if (isFree) {
      return getFreeEntries(indexEntries);
    }
    return getPaidEntriesSigned(indexEntries, traceId, caoDid, burnerDid);
  };

  const resolveDidDocument = async ({
    did,
    credentials,
    burnerDid,
    caoDid,
  }) => {
    log.info({ did, credentials, burnerDid, caoDid }, 'resolveDidDocument');
    const { traceId } = context;
    const indexEntries = parseVelocityV2Did(did);
    const entries = await resolveContractEntries({
      credentials,
      indexEntries,
      traceId,
      caoDid,
      burnerDid,
    });
    if (isEmpty(entries)) {
      throw new Error(`Entries were not retrieved for ${indexEntries}.`);
    }

    const credentialEntries = await Promise.all(
      mapWithIndex(async (entry, i) => {
        const credential = find((c) => {
          const credentialIndexEntry = parseSingleVelocityDid(c.id);
          return (
            credentialIndexEntry.accountId === indexEntries[i].accountId &&
            credentialIndexEntry.listId === indexEntries[i].listId &&
            credentialIndexEntry.index === indexEntries[i].index
          );
        }, credentials);
        const secret =
          indexEntries[i].contentHash != null
            ? await deriveEncryptionSecretFromPassword(
                indexEntries[i].contentHash,
              )
            : await deriveEncryptionSecret(credential);
        return {
          entry,
          id: credential.id,
          credentialType: credential.credentialType,
          secret,
        };
      }, entries),
    );
    log.info({ credentialEntries }, 'resolveDidDocument 1');

    const publicKeys = await Promise.all(
      map(resolvePublicKey, credentialEntries),
    );

    const [resolvedPublicKeys, unresolvedPublicKeys] = partition(
      ({ publicKeyJwk }) => !!publicKeyJwk,
      publicKeys,
    );

    const service = map(resolveService, credentialEntries);

    const didDocument = {
      id: did,
      publicKey: resolvedPublicKeys,
      service,
    };

    const didDocumentMetadata = {
      boundIssuerVcs: map(resolveIssuerVc, credentialEntries),
    };

    log.info(
      { didDocument, didDocumentMetadata, unresolvedPublicKeys },
      'resolveDidDocument 3',
    );

    if (isEmpty(unresolvedPublicKeys)) {
      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: {},
      };
    }

    const didResolutionMetadata = {
      error: RESOLUTION_METADATA_ERROR.UNRESOLVED_MULTI_DID_ENTRIES,
      unresolvedMultiDidEntries: map(
        ({ id }) => ({
          id,
          error: RESOLUTION_METADATA_ERROR.DATA_INTEGRITY_ERROR,
        }),
        unresolvedPublicKeys,
      ),
    };

    log.error({ didResolutionMetadata }, 'Unable to resolve did entries');

    return {
      didDocument,
      didDocumentMetadata,
      didResolutionMetadata,
    };
  };

  const setPermissionsAddress = async (permissionsContractAddress) => {
    const tx = await contractClient.setPermissionsAddress(
      permissionsContractAddress,
    );

    return tx.wait();
  };

  const pullCreatedMetadataListEvents = pullEvents('CreatedMetadataList');

  const pullAddedCredentialMetadataEvents = pullEvents(
    'AddedCredentialMetadata',
  );

  return {
    createCredentialMetadataList,
    addCredentialMetadataEntry,
    contractClient,
    isFreeCredentialTypeList,
    isFreeCredentialType,
    isExistMetadataList,
    getPaidEntriesSigned,
    getFreeEntries,
    setEntrySigned,
    resolveContractEntries,
    resolveDidDocument,
    setPermissionsAddress,
    pullCreatedMetadataListEvents,
    pullAddedCredentialMetadataEvents,
    parseVelocityV2Did,
  };
};

const deriveEncryptionSecret = async (credential) => {
  const contentHash = credential?.contentHash;
  if (!contentHash) {
    throw new Error(
      `Could not resolve content hash from VC with ${credential.id}`,
    );
  }
  return deriveEncryptionSecretFromPassword(contentHash);
};

module.exports = initMetadataRegistry;
