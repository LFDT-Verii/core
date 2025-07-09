const getMetrics = async ({ start, end, did }, { db }) => {
  const offersCollection = db.collection('offers');
  const result = await offersCollection
    .aggregate([
      {
        $match: {
          $and: [
            {
              consentedAt: {
                $gte: start,
                $lte: end,
              },
            },
            {
              'issuer.id': did,
            },
            {
              type: {
                $nin: [
                  'IdDocument',
                  'Phone',
                  'Email',
                  'IdDocumentV1.0',
                  'DriversLicenseV1.0',
                  'NationalIdCardV1.0',
                  'PassportV1.0',
                  'ResidentPermitV1.0',
                  'EmailV1.0',
                  'PhoneV1.0',
                  'ProofOfAgeV1.0',
                ],
              },
            },
            {
              did: { $exists: true },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: 1,
          },
          unique: {
            $addToSet: '$credentialSubject.vendorUserId',
          },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          unique: { $size: '$unique' },
        },
      },
    ])
    .toArray();

  const total = result[0]?.total || 0;
  const unique = result[0]?.unique || 0;

  return {
    total,
    unique,
  };
};

module.exports = {
  getMetrics,
};
