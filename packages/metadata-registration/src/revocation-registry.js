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

/* eslint-disable camelcase */
const ethUrlParser = require('eth-url-parser');
const {
  initContractClient,
  initContractWithTransactingClient,
} = require('@verii/base-contract-io');

const contractAbi = require('./contracts/revocation-registry.json');
const { RevocationRegistryErrorCodes } = require('./constants');

const invalidRevocationUrlError = (message, cause) => {
  const error = new Error(message, cause == null ? undefined : { cause });
  error.code = RevocationRegistryErrorCodes.INVALID_REVOCATION_URL;
  return error;
};

const parseRevocationUrl = (url) => {
  try {
    return ethUrlParser.parse(url);
  } catch (error) {
    throw invalidRevocationUrlError(error.message, error);
  }
};

const assertRevocationUrlTarget = (
  { scheme, target_address, function_name },
  contractAddress,
) => {
  if (
    target_address !== contractAddress ||
    function_name !== 'getRevokedStatus' ||
    scheme !== 'ethereum'
  ) {
    throw invalidRevocationUrlError(
      'Wrong url, please check the params: scheme, target_address, function_name',
    );
  }
};

const revocationUrlParameters = ({ parameters = {} }) => {
  const { address, listId, index } = parameters;
  if (address == null || listId == null || index == null) {
    throw invalidRevocationUrlError(
      'Wrong url, please check the params: address, listId, index',
    );
  }
  return { address, listId, index };
};

// A URL that cannot be parsed, names another contract or function, or lacks
// a parameter throws an error with code invalid_revocation_url before any
// contract call, so callers can tell invalid status data from a failed call.
const parseGetRevokedStatusUrl = (url, contractAddress) => {
  const parsedUrl = parseRevocationUrl(url);
  assertRevocationUrlTarget(parsedUrl, contractAddress);
  return revocationUrlParameters(parsedUrl);
};

const initRevocationRegistry = async (
  { privateKey, contractAddress, rpcProvider },
  context,
) => {
  const { log } = context;
  log.info({ contractAddress }, 'initRevocationRegistry');

  const { contractClient, pullEvents } = await initContractClient(
    {
      privateKey,
      contractAddress,
      rpcProvider,
      contractAbi,
    },
    context,
  );

  const addWalletToRegistrySigned = async ({ caoDid }) => {
    log.info({ caoDid }, 'addWalletToRegistrySigned');
    const { traceId } = context;
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
    const tx = await transactingClient.contractClient.addWalletSigned(
      traceId,
      caoDid,
      signature,
    );
    const txResult = await tx.wait();
    return { txResult };
  };

  const addRevocationListSigned = async (listId, caoDid) => {
    log.info({ listId, caoDid }, 'addRevocationListSigned');
    const { traceId } = context;
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
    const tx = await transactingClient.contractClient.addRevocationListSigned(
      listId,
      traceId,
      caoDid,
      signature,
    );
    const txResult = await tx.wait();
    return { txResult };
  };

  const getRevokeUrl = (accountId, listId, index) => {
    return ethUrlParser.build({
      scheme: 'ethereum',
      target_address: contractAddress,
      function_name: 'getRevokedStatus',
      parameters: {
        address: accountId,
        listId,
        index,
      },
    });
  };

  const setRevokedStatusSigned = async ({
    accountId,
    listId,
    index,
    caoDid,
  }) => {
    log.info({ listId, index }, 'setRevokedStatusSigned');

    const { traceId } = context;
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
    const tx = await transactingClient.contractClient.setRevokedStatusSigned(
      listId,
      index,
      traceId,
      caoDid,
      signature,
    );
    const txResult = await tx.wait();
    return {
      url: getRevokeUrl(accountId, listId, index),
      txResult,
    };
  };

  const getRevokedStatus = (url) => {
    log.info({ url }, 'getRevokedStatus');

    const { address, listId, index } = parseGetRevokedStatusUrl(
      url,
      contractAddress,
    );

    return contractClient.getRevokedStatus(address, listId, index);
  };

  const setPermissionsAddress = async (permissionsContractAddress) => {
    const tx = await contractClient.setPermissionsAddress(
      permissionsContractAddress,
    );

    return tx.wait();
  };

  const pullWalletAddedEvents = pullEvents('WalletAdded');

  const pullRevocationListCreateEvents = pullEvents('RevocationListCreate');

  const pullRevokedStatusUpdateEvents = pullEvents('RevokedStatusUpdate');

  return {
    contractClient,
    addWalletToRegistrySigned,
    addRevocationListSigned,
    setRevokedStatusSigned,
    getRevokedStatus,
    getRevokeUrl,
    setPermissionsAddress,
    pullWalletAddedEvents,
    pullRevocationListCreateEvents,
    pullRevokedStatusUpdateEvents,
  };
};

module.exports = initRevocationRegistry;
