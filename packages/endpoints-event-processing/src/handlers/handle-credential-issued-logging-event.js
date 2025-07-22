const { map, forEach } = require('lodash/fp');
const {
  initMetadataRegistry,
} = require('@verii/metadata-registration');
const { initDocumentFunctions, decodeIssuerVc } = require('../helpers');

const task = 'credential-issued-logging';

const mapEvent = (event) => ({
  blockNumber: event.blockNumber,
  blockHash: event.blockHash,
  transactionIndex: event.transactionIndex,
  transactionHash: event.transactionHash,
  event: event.fragment.name,
  sender: event.args[0],
  issuerDid: decodeIssuerVc(event.args[1]),
  listId: `${event.args[2]}`,
  credentialType: event.args[3],
  index: `${event.args[4]}`,
  eventTraceId: event.args[5],
  caoDid: event.args[6],
});

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

const handleCredentialIssuedLoggingEvent = async (context) => {
  const { log } = context;
  const { readLastSuccessfulBlock, writeLastSuccessfulBlock } =
    initDocumentFunctions({ eventName: task }, context);

  const readEventsFromBlock = await initReadEventsFromBlock(context);

  const lastReadBlock = await readLastSuccessfulBlock();

  log.info({ task, lastReadBlock });

  const { eventsCursor, latestBlock } = await readEventsFromBlock(
    lastReadBlock + 1
  );
  let numberOfEventsRead = 0;
  for await (const events of eventsCursor()) {
    numberOfEventsRead += events.length;
    const mappedEvents = map(mapEvent, events);
    forEach((event) => log.info(event), mappedEvents);
  }

  log.info({
    task,
    lastReadBlock,
    numberOfEventsRead,
  });

  log.info({ task, latestBlock });
  await writeLastSuccessfulBlock(latestBlock);
};

module.exports = {
  handleCredentialIssuedLoggingEvent,
};
