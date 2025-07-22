const { toHexString, toNumber } = require('@verii/blockchain-functions');

const mapCouponBurned = (evt, { log }) => {
  const expirationTime = new Date(toNumber(evt.args[6]) * 1000);
  let burnTime = new Date();
  try {
    burnTime = new Date(toNumber(evt.args[7]) * 1000);
  } catch (err) {
    log.info({ err });
    log.info('burnTime not present on event');
  }
  return {
    blockNumber: evt.blockNumber,
    blockHash: evt.blockHash,
    transactionIndex: evt.transactionIndex,
    transactionHash: evt.transactionHash,
    event: evt.fragment.name,
    owner: evt.args[0],
    bundleId: `${evt.args[1]}`,
    bundleIdHex: evt.args[1] ? toHexString(evt.args[1]) : undefined,
    eventTraceId: evt.args[2],
    caoDid: evt.args[3],
    burnerDid: evt.args[4],
    balance: toNumber(evt.args[5]),
    expirationTime,
    burnTime,
  };
};

module.exports = {
  mapCouponBurned,
};
