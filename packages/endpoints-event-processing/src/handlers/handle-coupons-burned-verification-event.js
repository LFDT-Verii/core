const { map, zip } = require('lodash/fp');
const { initVerificationCoupon } = require('@verii/metadata-registration');

const { batchOperations } = require('@verii/fineract-client');
const { getDidAndAliases } = require('@verii/did-doc');

const task = 'coupons-burned-verification';

const { initDocumentFunctions, mapCouponBurned } = require('../helpers');

const initReadEventsFromBlock = async (context) => {
  const { config } = context;
  const { pullBurnCouponEvents } = await initVerificationCoupon(
    {
      contractAddress: config.couponContractAddress,
      rpcProvider: context.rpcProvider,
    },
    context,
  );

  return async (block) => {
    return pullBurnCouponEvents(block);
  };
};
const syncBurnsWithFineract = async (
  { burnerDidToBundleMap, organizationsMap, burnEvents },
  context,
) => {
  const { log } = context;
  if (burnerDidToBundleMap.size === 0) {
    return [];
  }

  const voucherQuantitiesToBurn = map((burnEvent) => {
    const orgOfBurnEvent = organizationsMap.get(burnEvent.burnerDid);
    return {
      clientId: orgOfBurnEvent.ids.fineractClientId,
      quantity: 1,
      submittedOnDate: burnEvent.burnTime,
    };
  }, burnEvents);

  log.info({ task, voucherQuantitiesToBurn });
  const batchResponses = await batchOperations(
    { clientVoucherBurns: voucherQuantitiesToBurn, transactionalBatch: false },
    context,
  );

  for (const [payload, batchResponse] of zip(
    voucherQuantitiesToBurn,
    batchResponses,
  )) {
    if (batchResponse.statusCode >= 400)
      log.warn({
        code: 'failed-burn-sync',
        batchResponse,
        payload,
      });
  }

  return batchResponses;
};

const writeBurnsToDatabase = async (
  { burnerDidToBundleMap, organizationsMap },
  context,
) => {
  const { repos } = context;
  if (burnerDidToBundleMap.size === 0) {
    return [];
  }
  const now = new Date();
  const burnedCouponsProms = [];
  for (const [burnerDid, bundleToBurnsMap] of burnerDidToBundleMap.entries()) {
    for (const [bundleId, count] of bundleToBurnsMap.entries()) {
      const prom = async () => {
        const purchase = await repos.purchases.findOne({
          filter: {
            'couponBundle.couponBundleId': bundleId,
            $expr: { $lt: ['$couponBundle.used', '$couponBundle.quantity'] },
          },
        });

        if (!purchase) return Promise.resolve();

        await repos.purchases.collection().findOneAndUpdate(
          { _id: purchase._id },
          {
            $inc: {
              'couponBundle.used': count,
            },
          },
        );

        return repos.burnedCoupons.insert({
          purchaseId: purchase.purchaseId,
          used: count,
          at: now,
          clientId: organizationsMap.get(burnerDid)?.ids.brokerClientId,
        });
      };
      burnedCouponsProms.push(prom());
    }
  }
  return Promise.all(burnedCouponsProms);
};

const processEventGenerator = async ({ eventsCursor }, context) => {
  const burnerDidToBundleMap = new Map();
  let numberOfEventsRead = 0;
  let burnEvents = [];
  for await (const selectedEvents of eventsCursor()) {
    const mappedEvents = map(
      (evt) => mapCouponBurned(evt, context),
      selectedEvents,
    );
    burnEvents = [...burnEvents, ...mappedEvents];
    numberOfEventsRead += selectedEvents.length;
    for (const evt of mappedEvents) {
      const { burnerDid, bundleIdHex: bundleId } = evt;
      // eslint-disable-next-line max-depth
      if (!burnerDidToBundleMap.has(burnerDid)) {
        burnerDidToBundleMap.set(burnerDid, new Map());
      }
      const bundleToBurnsMap = burnerDidToBundleMap.get(burnerDid);
      // eslint-disable-next-line max-depth
      if (!bundleToBurnsMap.has(bundleId)) {
        bundleToBurnsMap.set(bundleId, 0);
      }
      bundleToBurnsMap.set(bundleId, bundleToBurnsMap.get(bundleId) + 1);
    }
  }
  return {
    burnEvents,
    numberOfEventsRead,
    burnerDidToBundleMap,
  };
};

const handleCouponsBurnedVerificationEvent = async (context) => {
  const { log, repos } = context;
  const { readLastSuccessfulBlock, writeLastSuccessfulBlock } =
    initDocumentFunctions({ eventName: task }, context);

  const readEventsFromBlock = await initReadEventsFromBlock(context);

  const lastReadBlock = await readLastSuccessfulBlock();
  log.info({ task, lastReadBlock });
  const initialBlockNumber = lastReadBlock + 1;
  const { eventsCursor, latestBlock } =
    await readEventsFromBlock(initialBlockNumber);

  const { numberOfEventsRead, burnEvents, burnerDidToBundleMap } =
    await processEventGenerator({ eventsCursor }, context);
  log.info({
    task,
    lastReadBlock,
    numberOfEventsRead,
  });

  const organizations = await repos.organizations.findByDids(
    Array.from(burnerDidToBundleMap.keys()),
  );
  const organizationsMap = new Map();
  for (const organization of organizations) {
    const ids = getDidAndAliases(organization?.didDoc);
    for (const id of ids) {
      organizationsMap.set(id, organization);
    }
  }

  await writeBurnsToDatabase(
    { burnerDidToBundleMap, organizationsMap },
    context,
  );
  await syncBurnsWithFineract(
    { burnerDidToBundleMap, organizationsMap, burnEvents },
    context,
  );

  log.info({ task, latestBlock });
  await writeLastSuccessfulBlock(latestBlock);
};

module.exports = {
  handleCouponsBurnedVerificationEvent,
};
