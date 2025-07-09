const { isEmpty, set } = require('lodash/fp');
const { endOfDay, startOfDay } = require('date-fns/fp');

module.exports = async (fastify) => {
  fastify.get(
    '/',
    {
      onRequest: fastify.verifyAdmin,
      schema: {
        query: {
          type: 'object',
          properties: {
            vendorDisclosureId: {
              type: 'string',
              description:
                '(optional) the vendor disclosure id to get submissions for',
            },
            dateFrom: {
              type: 'string',
              format: 'date',
              description:
                '(optional) only get submissions for dates on or after this date',
            },
            dateUntil: {
              type: 'string',
              format: 'date',
              description:
                '(optional) only get submissions for dates on or before this date',
            },
          },
        },
      },
    },
    async ({ repos, query }) => {
      let filter = {};
      if (!isEmpty(query.vendorDisclosureId)) {
        filter = set('vendorDisclosureId', query.vendorDisclosureId, filter);
      }
      if (!isEmpty(query.dateFrom)) {
        filter = set(
          'createdAt.$gte',
          startOfDay(new Date(query.dateFrom)),
          filter
        );
      }
      if (!isEmpty(query.dateUntil)) {
        filter = set(
          'createdAt.$lte',
          endOfDay(new Date(query.dateFrom)),
          filter
        );
      }
      return repos.credentialSubmissions.find({
        filter,
        sort: { createdAt: -1 },
      });
    }
  );
};
