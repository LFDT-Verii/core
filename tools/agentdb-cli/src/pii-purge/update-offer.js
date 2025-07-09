const updateOffer = (offer, time) => ({
  updateOne: {
    filter: {
      _id: offer._id,
    },
    update: {
      $set: {
        credentialSubject: {
          vendorUserId: offer.credentialSubject.vendorUserId,
        },
        updatedAt: time,
      },
    },
  },
});

module.exports = { updateOffer };
