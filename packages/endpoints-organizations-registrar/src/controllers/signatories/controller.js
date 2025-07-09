const {
  RegistrarScopes,
  sendReminders,
  initSendEmailNotifications,
} = require('../../entities');

const signatoriesController = async (fastify) => {
  const { sendEmailToSignatoryForOrganizationApproval } =
    initSendEmailNotifications(fastify);

  fastify.post(
    '/send-reminder',
    {
      onRequest: [fastify.verifyAccessToken([RegistrarScopes.EventsTrigger])],
      schema: fastify.autoSchema({
        tags: ['signatory-management-event-processing'],
        security: [
          {
            RegistrarOAuth2: [RegistrarScopes.EventsTrigger],
          },
        ],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
          },
        },
      }),
    },
    async (req) => {
      setTimeout(async () => {
        try {
          await sendReminders(sendEmailToSignatoryForOrganizationApproval, req);
        } catch (e) {
          req.log.warn(e);
        }
      }, 0);
      return {};
    }
  );
};

module.exports = signatoriesController;
