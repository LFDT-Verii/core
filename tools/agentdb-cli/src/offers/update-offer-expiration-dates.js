const { isEmpty, each } = require('lodash/fp');
const { printInfo } = require('../helpers/common');

const updateOfferExpirationDates = async ({ db, dids }) => {
  const filter = {};
  if (!isEmpty(dids)) {
    filter['issuer.id'] = { $in: dids };
    printInfo('Filtering by dids:');
    each((did) => {
      printInfo(did);
    }, dids);
  }

  const collection = db.collection('offers');
  const newExpirationDate = new Date(Date.UTC(2030, 0, 1));
  const result = await collection.updateMany(filter, {
    $set: { offerExpirationDate: newExpirationDate, updatedAt: new Date() },
  });
  printInfo(`${result.modifiedCount} offers updated`);
};

module.exports = { updateOfferExpirationDates };
