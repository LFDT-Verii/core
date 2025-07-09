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
        response: {
          200: {
            type: 'object',
            properties: {
              identifications: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    async ({ repos, query }) => {
      let filter = {};
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
      const identifications = await repos.identifications.find({
        filter,
        sort: { createdAt: -1 },
      });

      return { identifications };
    }
  );
};
