// eslint-disable-next-line import/no-extraneous-dependencies
const { parseToCsv } = require('@verii/csv-parser');
const { csvResponseHook } = require('@verii/fastify-plugins');
const { toStartOfDay, toEndOfDay } = require('@verii/rest-queries');

const offerDataController = async (fastify) => {
  fastify.get(
    '/',
    {
      onSend: csvResponseHook('get-offers.csv'),
      schema: fastify.autoSchema({
        querystring: {
          type: 'object',
          properties: {
            StartDate: { type: 'string', format: 'date' },
            EndDate: { type: 'string', format: 'date' },
            claimed: { type: 'boolean' },
          },
          required: ['StartDate', 'EndDate'],
        },
        response: {
          200: { content: { 'text/csv': { schema: { type: 'null' } } } },
        },
      }),
    },
    async ({ repos, query }) => {
      const offers = await repos.offers.find(
        {
          filter: buildOfferFilter(query),
          limit: Number.MAX_SAFE_INTEGER,
          sort: { createdAt: 1 },
        },
        {
          did: 1,
          type: 1,
          credentialSubject: 1,
          offerId: 1,
          consentedAt: 1,
          createdAt: 1,
          credentialStatus: 1,
          issuer: 1,
        }
      );

      if (offers.length === 0) {
        return '';
      }

      return parseToCsv(
        offers.map((offer) => ({
          '1. Offer Accepted': offer.did,
          '2. User': offer.credentialSubject?.vendorUserId,
          '3. Offer ID': offer.offerId,
          '4. Credential Type': offer.type[0],
          '5. Offer Creation Date': offer.createdAt,
          '6. Offer Claim Date': offer.consentedAt,
          '7. Revocation Status': offer.credentialStatus?.revokedAt,
          '8. Issuer ID': offer.issuer.id,
        }))
      );
    }
  );
};

const buildOfferFilter = (query) => {
  const filter = {
    createdAt: {
      $gte: toStartOfDay(query.StartDate),
      $lte: toEndOfDay(query.EndDate),
    },
  };
  if (query.claimed === true) {
    filter.consentedAt = { $exists: true };
  }
  return filter;
};

module.exports = offerDataController;
