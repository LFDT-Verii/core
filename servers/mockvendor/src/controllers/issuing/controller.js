const {
  first,
  isEmpty,
  toLower,
  map,
  omitBy,
  omit,
  isNil,
} = require('lodash/fp');
const { wait } = require('@verii/common-functions');
const newError = require('http-errors');
const { generateOffersSchema } = require('../../entities');

module.exports = async (fastify) => {
  fastify.addSchema(generateOffersSchema(fastify));

  fastify.post('/identify', async (req) => {
    const { body: identification, repos } = req;
    await repos.identifications.insert({ identification });
    const { emails, vendorOriginContext: token } = identification;
    const user = await repos.users.findOne({
      filter: buildUsersFilter({ emails, token }),
    });
    if (!user) {
      throw new newError.NotFound();
    }
    const vendorUserId = first(user.emails);
    return { vendorUserId };
  });

  fastify.post(
    '/generate-offers',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            types: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            vendorUserId: {
              type: 'string',
            },
            vendorOrganizationId: {
              type: 'string',
            },
            tenantDID: {
              type: 'string',
            },
            exchangeId: {
              type: 'string',
            },
          },
          anyOf: [
            { required: ['vendorOrganizationId'] },
            { required: ['tenantDID'] },
          ],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              offers: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/generate-offers.schema.json#',
                },
              },
            },
          },
        },
      },
    },
    async ({ body, repos, config }, reply) => {
      const { omitOfferId, noOffers200, generateOffersDelaySec } = config;

      await wait(generateOffersDelaySec);

      const offers = await repos.offers.find(
        { filter: buildOffersFilter(body) },
        omitBy(isNil, {
          _id: 0,
          label: 0,
          createdAt: 0,
          updatedAt: 0,
          offerId: omitOfferId ? 0 : null,
        })
      );
      if (!isEmpty(offers) || noOffers200) {
        return { offers };
      }

      await repos.issuingExchanges.insert({
        type: body.types,
        ...omit(['types'], body),
      });

      return reply.status(202).send({});
    }
  );

  fastify.post('/receive-issued-credentials', async (req) => {
    const { body, repos } = req;
    return repos.acceptedOffers.insert(body);
  });
};

const buildIssuerFilter = ({ tenantDID, vendorOrganizationId }) => {
  if (!isEmpty(tenantDID) && !isEmpty(vendorOrganizationId)) {
    return {
      $or: [
        { 'issuer.id': tenantDID },
        { 'issuer.vendorOrganizationId': vendorOrganizationId },
      ],
    };
  }
  if (!isEmpty(tenantDID)) {
    return { 'issuer.id': tenantDID };
  }
  if (!isEmpty(vendorOrganizationId)) {
    return { 'issuer.vendorOrganizationId': vendorOrganizationId };
  }
  return {};
};
const buildTypesFilter = ({ types }) => {
  if (!isEmpty(types)) {
    return { type: { $elemMatch: { $in: types } } };
  }

  return {};
};

const buildUsersFilter = ({ emails, token }) => {
  const $or = [];
  if (!isEmpty(emails)) {
    $or.push({
      emails: { $in: map(toLower, emails) },
    });
  }
  if (!isEmpty(token)) {
    $or.push({
      token,
    });
  }
  return {
    $or,
  };
};

const buildOffersFilter = ({ vendorUserId, ...props }) => ({
  'credentialSubject.vendorUserId': vendorUserId,
  exchangeId: { $exists: false },
  ...buildIssuerFilter(props),
  ...buildTypesFilter(props),
});
