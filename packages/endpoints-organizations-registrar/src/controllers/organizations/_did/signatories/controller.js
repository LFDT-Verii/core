const {
  signatoryApproveOrganizationEmail,
  approveReminder,
  rejectReminder,
  validateAuthCode,
} = require('../../../../entities');

const signatoriesController = async (fastify) => {
  const { sendEmail } = fastify;

  fastify.get(
    '/response/:response',
    {
      schema: fastify.autoSchema({
        params: {
          type: 'object',
          properties: {
            did: {
              type: 'string',
            },
            response: {
              type: 'string',
              enum: ['approve', 'reject'],
            },
          },
          required: ['did', 'response'],
        },
        querystring: {
          type: 'object',
          properties: {
            authCode: {
              type: 'string',
            },
          },
          required: ['authCode'],
        },
        response: {
          200: { type: 'null' },
          401: { $ref: 'error#' },
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req) => {
      const { repos, params, query } = req;
      const { did, response } = params;
      const { authCode } = query;
      const organization = await repos.organizations.findOneByDid(did);
      await validateAuthCode(organization, authCode, req);
      await sendEmail(
        signatoryApproveOrganizationEmail({ organization, response }, req)
      );
      if (response === 'approve') {
        await approveReminder(organization, req);
      } else {
        await rejectReminder(organization, req);
      }
      return {};
    }
  );
};

module.exports = signatoriesController;
