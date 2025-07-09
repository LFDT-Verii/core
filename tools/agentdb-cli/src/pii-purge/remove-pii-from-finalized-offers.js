const { map, size, forEach } = require('lodash/fp');
const { printInfo } = require('../helpers/common');
const { updateOffer } = require('./update-offer');

const removePiiFromFinalizedOffers = async ({ db }) => {
  const currentTime = new Date();
  const filter = {
    $or: [
      { consentedAt: { $exists: true } },
      { rejectedAt: { $exists: true } },
      { offerExpirationDate: { $lt: new Date() } },
    ],
  };
  const collection = db.collection('offers');
  const offers = await collection.find(filter).toArray();
  printInfo(`Found ${size(offers)} offers to update`);
  if (!size(offers)) {
    return;
  }
  const updates = map((i) => updateOffer(i, currentTime), offers);
  await collection.bulkWrite(updates);
  forEach(
    ({ _id }) => printInfo(`Offer with _id (${_id.toString()}) was updated`),
    offers
  );
};

module.exports = { removePiiFromFinalizedOffers };
