const { map, forEach } = require('lodash/fp');
const { toHexString } = require('@verii/blockchain-functions');
const { initVerificationCoupon } = require('@verii/metadata-registration');
const { initDocumentFunctions } = require('../helpers');

const task = 'coupons-minted-logging';

const mapEvent = (event) => ({
  blockNumber: event.blockNumber,
  blockHash: event.blockHash,
  transactionIndex: event.transactionIndex,
  transactionHash: event.transactionHash,
  event: event.fragment.name,
  owner: event.args[0],
  bundleId: `${event.args[1]}`,
  bundleIdHex: toHexString(event.args[1]),
  expirationTime: new Date(Number(`${event.args[2]}`) * 1000),
  quantity: `${event.args[3]}`,
  eventTraceId: event.args[4],
  ownerDid: event.args[5],
});

const initReadEventsFromBlock = async (context) => {
  const { config } = context;
  const { pullMintCouponBundleEvents } = await initVerificationCoupon(
    {
      contractAddress: config.couponContractAddress,
      rpcProvider: context.rpcProvider,
    },
    context,
  );

  return async (block) => {
    return pullMintCouponBundleEvents(block);
  };
};

const handleCouponsMintedLoggingEvent = async (context) => {
  const { log } = context;
  const { readLastSuccessfulBlock, writeLastSuccessfulBlock } =
    initDocumentFunctions({ eventName: task }, context);

  const readEventsFromBlock = await initReadEventsFromBlock(context);

  const lastReadBlock = await readLastSuccessfulBlock();

  log.info({ task, lastReadBlock });

  const { eventsCursor, latestBlock } = await readEventsFromBlock(
    lastReadBlock + 1,
  );
  let numberOfEventsRead = 0;
  for await (const events of eventsCursor()) {
    numberOfEventsRead += events.length;
    const mappedEvents = map(mapEvent, events);
    forEach((event) => {
      log.info(event);
    }, mappedEvents);
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
  handleCouponsMintedLoggingEvent,
};
