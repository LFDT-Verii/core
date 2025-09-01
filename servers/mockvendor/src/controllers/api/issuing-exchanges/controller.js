const { map, omit, castArray, isNil, omitBy } = require('lodash/fp');
const { nanoid } = require('nanoid');
const {
  submitCreateExchange,
  submitOffer,
  completeSubmitOffer,
  getExchangeQrCode,
} = require('./fetchers');

const createExchange = async (tenantDID, context) => {
  const exchange = await submitCreateExchange(tenantDID, 'ISSUING', context);

  await context.repos.issuingExchanges.insert({
    exchangeId: exchange.id,
    tenantDID,
  });

  return exchange.id;
};

const prepOffer = (exchangeId, tenantDID) => (offer) => ({
  offerId: nanoid(),
  exchangeId,
  issuer: { id: tenantDID },
  ...offer,
});

const createCredentialAgentOffers = async (
  offers,
  tenantDID,
  exchangeId,
  context
) => {
  const { repos } = context;

  const insertedOffers = await repos.offers.insertMany(
    map(prepOffer(exchangeId, tenantDID), offers)
  );

  await Promise.all(
    map(
      (offer) =>
        submitOffer(
          {
            offer: omit(['id', 'exchangeId'], offer),
            exchangeId,
            tenantDID,
          },
          context
        ),
      insertedOffers
    )
  );
  await completeSubmitOffer({ exchangeId, tenantDID }, context);
  return { exchangeId, tenantDID, offers: insertedOffers };
};

const controller = async (fastify) => {
  fastify.get(
    '/:tenantDID',
    {
      onRequest: fastify.verifyAdmin,
      schema: {
        params: {
          type: 'object',
          properties: {
            tenantDID: { type: 'string' },
          },
          required: ['tenantDID'],
        },
        query: {
          type: 'object',
          properties: {
            exchangeId: { type: 'string' },
            issuer: { type: 'string' },
            vendorUserId: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            credentialTypes: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
          },
        },
      },
    },
    async (req) => {
      const {
        query: { credentialTypes, exchangeId, vendorUserId, date },
        params: { tenantDID },
        repos,
      } = req;
      return repos.issuingExchanges.find({
        filter: omitBy(isNil, {
          exchangeId,
          issuer: { id: tenantDID },
          vendorUserId,
          createdAt: date ? { $gte: new Date(date) } : undefined,
          type: {
            $in: castArray(credentialTypes),
          },
        }),
      });
    }
  );
  fastify.post(
    '/:tenantDID/:exchangeId/push-offers',
    {
      onRequest: fastify.verifyAdmin,
      schema: {
        params: {
          type: 'object',
          properties: {
            exchangeId: { type: 'string' },
            tenantDID: { type: 'string' },
          },
          required: ['tenantDID', 'exchangeId'],
        },
        body: {
          type: 'object',
          required: ['offer'],
          properties: {
            offer: {
              oneOf: [
                {
                  $ref: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json#',
                },
                {
                  type: 'array',
                  items: {
                    $ref: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json#',
                  },
                },
              ],
            },
          },
        },
      },
    },
    async (req) => {
      const {
        body: { offer },
        params: { exchangeId, tenantDID },
      } = req;
      const { offers } = await createCredentialAgentOffers(
        castArray(offer),
        tenantDID,
        exchangeId,
        req
      );

      return offers;
    }
  );

  fastify.post(
    '/:tenantDID/create-qrcode',
    {
      onRequest: fastify.verifyAdmin,
      schema: {
        params: {
          type: 'object',
          properties: {
            tenantDID: { type: 'string' },
          },
          required: ['tenantDID'],
        },
        body: {
          type: 'object',
          required: ['offer'],
          properties: {
            vendorOriginContext: {
              type: 'string',
            },
            offer: {
              oneOf: [
                {
                  $ref: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json#',
                },
                {
                  type: 'array',
                  items: {
                    $ref: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json#',
                  },
                },
              ],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const {
        body: { offer, vendorOriginContext },
        params: { tenantDID },
      } = req;
      const exchangeId = await createExchange(tenantDID, req);
      await createCredentialAgentOffers(
        castArray(offer),
        tenantDID,
        exchangeId,
        req
      );

      const response = await getExchangeQrCode(
        tenantDID,
        exchangeId,
        vendorOriginContext,
        req
      );

      return reply.type('image/png').send(response.rawBody);
    }
  );
};

module.exports = controller;
