const { isEmpty } = require('lodash/fp');
const { ObjectId } = require('mongodb');

const buildCleanPiiFilter = (filter = {}) => {
  const mongoFilter = {};

  if (!isEmpty(filter.vendorUserId)) {
    mongoFilter['credentialSubject.vendorUserId'] = filter.vendorUserId;
  }

  if (!isEmpty(filter.disclosureId)) {
    mongoFilter.disclosureId = new ObjectId(filter.disclosureId);
  }

  if (!isEmpty(filter.createdBefore)) {
    mongoFilter.createdAt = { $lte: new Date(filter.createdBefore) };
  }

  if (filter.finalized === true) {
    mongoFilter.$or = [
      {
        rejectedAt: { $exists: true },
      },
      {
        consentedAt: { $exists: true },
      },
    ];
  }

  return mongoFilter;
};

module.exports = {
  buildCleanPiiFilter,
};
