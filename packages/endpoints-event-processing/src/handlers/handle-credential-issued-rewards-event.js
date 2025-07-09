const {
  partition,
  reduce,
  map,
  size,
  isEmpty,
  uniq,
  flow,
  find,
} = require('lodash/fp');
const { initMetadataRegistry } = require('@verii/metadata-registration');

const { get2BytesHash } = require('@verii/crypto');
const { batchTransferCredits } = require('@verii/fineract-client');

const { getDidAndAliases } = require('@verii/did-doc');
const { TransactionReasons } = require('../entities');
const { decodeIssuerVc, initDocumentFunctions } = require('../helpers');

const task = 'credential-issued-rewards';

const initReadEventsFromBlock = async (context) => {
  const { config } = context;
  const { pullAddedCredentialMetadataEvents } = await initMetadataRegistry(
    {
      contractAddress: config.metadataRegistryContractAddress,
      rpcProvider: context.rpcProvider,
    },
    context
  );

  return async (block) => {
    return pullAddedCredentialMetadataEvents(block);
  };
};
const executeTransfers = async (
  { rewardsDictionary, organizations },
  context
) => {
  const {
    config: { vnfRewardDispersalAccountId },
    log,
  } = context;
  if (isEmpty(rewardsDictionary)) {
    return [];
  }
  const transfers = reduce(
    (acc, nextOrganization) => {
      const dids = getDidAndAliases(nextOrganization?.didDoc);
      for (const id of dids) {
        const caoKey = `${id}.caoReward`;
        if (rewardsDictionary[caoKey]) {
          acc.push({
            fromAccount: vnfRewardDispersalAccountId,
            toAccount: nextOrganization.ids.tokenAccountId,
            amount: rewardsDictionary[caoKey],
            description: TransactionReasons.CAO_ISSUING_REWARD,
          });
        }
        const issuerKey = `${id}.issuerReward`;
        if (rewardsDictionary[issuerKey]) {
          acc.push({
            fromAccount: vnfRewardDispersalAccountId,
            toAccount: nextOrganization.ids.tokenAccountId,
            amount: rewardsDictionary[issuerKey],
            description: TransactionReasons.ISSUER_ISSUING_REWARD,
          });
        }
      }

      return acc;
    },
    [],
    organizations
  );

  log.info({ task, transfers });

  return batchTransferCredits({ transfers }, context);
};

const eventsToOrganizationTransactions = async (
  { eventsCursor, credentialTypes },
  context
) => {
  const {
    config: { issuerRewardAmount, caoRewardAmount },
  } = context;
  const rewardsDictionary = {};
  const dids = [];
  const calcIssuerReward = (issuerKey) => {
    const currentIssuerReward = rewardsDictionary[issuerKey] ?? 0;
    return currentIssuerReward + issuerRewardAmount;
  };

  const calcCaoReward = (caoKey) => {
    const currentCaoReward = rewardsDictionary[caoKey] ?? 0;
    return currentCaoReward + caoRewardAmount;
  };
  let numberOfEventsRead = 0;
  for await (const events of eventsCursor()) {
    numberOfEventsRead += events.length;
    const validEvents = getRewardableEvents(
      { events, credentialTypes },
      context
    );
    for (const { issuerKey, caoKey, issuerDid, caoDid } of validEvents) {
      dids.push(issuerDid);
      dids.push(caoDid);
      rewardsDictionary[issuerKey] = calcIssuerReward(issuerKey);
      rewardsDictionary[caoKey] = calcCaoReward(caoKey);
    }
  }
  return { rewardsDictionary, numberOfEventsRead, dids: uniq(dids) };
};

const handleCredentialIssuedRewardsEvent = async (context) => {
  const { log, repos } = context;
  const credentialTypes = await getCredentialTypes(context);
  const { readLastSuccessfulBlock, writeLastSuccessfulBlock } =
    initDocumentFunctions({ eventName: task }, context);

  const readEventsFromBlock = await initReadEventsFromBlock(context);

  const lastReadBlock = await readLastSuccessfulBlock();
  log.info({ task, lastReadBlock });
  const { eventsCursor, latestBlock } = await readEventsFromBlock(
    lastReadBlock + 1
  );
  const { rewardsDictionary, numberOfEventsRead, dids } =
    await eventsToOrganizationTransactions(
      { eventsCursor, credentialTypes },
      context
    );
  log.info({
    task,
    lastReadBlock,
    numberOfEventsRead,
    rewardsDictionary,
  });

  const allOrganizations = await repos.organizations.findByDids(dids);

  const [organizations, rejectedOrganizations] = partition(
    'ids.tokenAccountId',
    allOrganizations
  );

  const rejectOrgsCounts = size(rejectedOrganizations);
  if (rejectOrgsCounts > 0) {
    log.warn('organizations were rejected due to missing ids.tokenAccountId');
    log.warn({
      rejectedOrganizations: map('didDoc.id', rejectedOrganizations),
    });
  }

  await executeTransfers({ rewardsDictionary, organizations }, context);

  log.info({ task, latestBlock });
  await writeLastSuccessfulBlock(latestBlock);
};

const getRewardableEvents = ({ events, credentialTypes }, context) => {
  const [rewardableEvents, unRewardableEvents] = flow(
    map(mapEvent),
    partition(isRewardedEvent(credentialTypes))
  )(events);
  context.log.info({
    rewardableEvents,
    unRewardableEvents,
    events,
    credentialTypes,
  });
  return rewardableEvents;
};

const isRewardedEvent = (credentialTypes) => (event) => {
  const issuerDid = decodeIssuerVc(event.args[1]);
  const caoDid = event.args[6];
  const credentialType = find((ct) => {
    return ct.credentialType2BytesHash === event.credentialType2BytesHash;
  }, credentialTypes);

  return issuerDid != null && caoDid != null && credentialType?.layer1;
};

const mapEvent = (event) => {
  const issuerDid = decodeIssuerVc(event.args[1]);
  const caoDid = event.args[6];
  const credentialType2BytesHash = event.args[3];
  const issuerKey = `${issuerDid}.issuerReward`;
  const caoKey = `${caoDid}.caoReward`;
  return {
    issuerDid,
    caoDid,
    issuerKey,
    caoKey,
    credentialType2BytesHash,
    ...event,
  };
};

const getCredentialTypes = async (context) => {
  const { repos } = context;
  const credentialTypes = await repos.credentialSchemas.find({});
  return map(
    ({ credentialType, layer1 }) => ({
      credentialType,
      credentialType2BytesHash: get2BytesHash(credentialType),
      layer1,
    }),
    credentialTypes
  );
};

module.exports = {
  handleCredentialIssuedRewardsEvent,
};
