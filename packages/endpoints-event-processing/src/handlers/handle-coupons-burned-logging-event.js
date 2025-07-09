const { map, forEach } = require('lodash/fp');
const { initVerificationCoupon } = require('@verii/metadata-registration');
const { initDocumentFunctions, mapCouponBurned } = require('../helpers');

const task = 'coupons-burned-logging';

const initReadEventsFromBlock = async (context) => {
  const { config } = context;
  const { pullBurnCouponEvents } = await initVerificationCoupon(
    {
      contractAddress: config.couponContractAddress,
      rpcProvider: context.rpcProvider,
    },
    context
  );

  return async (block) => {
    return pullBurnCouponEvents(block);
  };
};

const handleCouponsBurnedLoggingEvent = async (context) => {
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
    const mappedEvents = map((evt) => mapCouponBurned(evt, context), events);
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
  handleCouponsBurnedLoggingEvent,
};
