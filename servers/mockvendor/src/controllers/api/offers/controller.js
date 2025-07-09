const { isArray, map } = require('lodash/fp');
const { nanoid } = require('nanoid');

const prepOffer = (offer) => ({
  offerId: nanoid(),
  ...offer,
});

module.exports = async (fastify) => {
  fastify.post(
    '/',
    {
      onRequest: fastify.verifyAdmin,
      schema: {
        body: {
          oneOf: [
            {
              $ref: 'https://velocitycareerlabs.io/new-mockvendor-offer.schema.json#',
            },
            {
              type: 'array',
              items: {
                $ref: 'https://velocitycareerlabs.io/new-mockvendor-offer.schema.json#',
              },
            },
          ],
        },
      },
    },
    async (req) => {
      const { body, repos } = req;
      const offers = isArray(body) ? body : [body];
      const preppedOffers = map(prepOffer, offers);
      return repos.offers.insertMany(preppedOffers);
    }
  );
  fastify.put(
    '/:id',
    {
      onRequest: fastify.verifyAdmin,
    },
    async (req) => {
      const {
        body,
        params: { id },
        repos,
      } = req;
      return repos.offers.update(id, body);
    }
  );
  fastify.get(
    '/:id',
    {
      onRequest: fastify.verifyAdmin,
    },
    async (req) => {
      const {
        params: { id },
        repos,
      } = req;
      return repos.offers.findById(id);
    }
  );
  fastify.get(
    '',
    {
      onRequest: fastify.verifyAdmin,
    },
    async ({ repos }) => {
      const offers = await repos.offers.find({});
      return offers;
    }
  );
  fastify.delete(
    '/:id',
    {
      onRequest: fastify.verifyAdmin,
    },
    async (req) => {
      const {
        params: { id },
        repos,
      } = req;
      return repos.offers.del(id);
    }
  );
};
