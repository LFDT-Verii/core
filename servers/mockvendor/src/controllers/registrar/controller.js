const { wait } = require('@verii/common-functions');
const { verifyVnfSignature } = require('@verii/crypto');
const { VNF_SIGNATURE_HTTP_HEADER_NAME } = require('@verii/crypto');

module.exports = async (fastify) => {
  fastify.post(
    '/registrar-webhook',
    {
      schema: {
        body: { $ref: 'registrar-message#' },
        response: {
          200: { $ref: 'registrar-message-response#' },
        },
      },
    },
    async (req) => {
      await processingRequest(req);
      return { messageType: 'ack', messageId: req.body.messageId };
    }
  );
  fastify.post(
    '/registrar-webhook-delay',
    {
      schema: {
        body: { $ref: 'registrar-message#' },
        response: {
          200: { $ref: 'registrar-message-response#' },
        },
      },
    },
    async (req) => {
      await wait(30000);
      await processingRequest(req);
      return { messageType: 'ack', messageId: req.body.messageId };
    }
  );
  fastify.post(
    '/registrar-webhook-bad-protocol',
    {
      schema: {
        body: { $ref: 'registrar-message#' },
        response: {
          200: {
            type: 'object',
            properties: {
              foo: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      await processingRequest(req);
      return { foo: 'foo' };
    }
  );
};

const processingRequest = async (req) => {
  const { repos } = req;
  const vnfSignatureVerified = verifyVnfSignature(
    req.body,
    req.headers[VNF_SIGNATURE_HTTP_HEADER_NAME],
    req
  );
  await repos.messages.insert({ ...req.body, vnfSignatureVerified });
};
