const { get, isNil, omitBy } = require('lodash/fp');
const { wait } = require('@verii/common-functions');
const { verifyVnfSignature } = require('@verii/crypto');
const { VNF_SIGNATURE_HTTP_HEADER_NAME } = require('@verii/crypto');
const { importTransferredKeys } = require('../../entities');

module.exports = async (fastify) => {
  fastify.post(
    '/registrar-webhook',
    { schema: registrarWebhookSchema },
    async (req) => {
      await receiveMessage(req);
      return buildAck(req);
    },
  );
  fastify.post(
    '/registrar-webhook-delay',
    { schema: registrarWebhookSchema },
    async (req) => {
      await wait(30000);
      await receiveMessage(req);
      return buildAck(req);
    },
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
      await storeMessage(req);
      return { foo: 'foo' };
    },
  );
};

const registrarWebhookSchema = {
  body: { $ref: 'registrar-message#' },
  response: {
    200: { $ref: 'registrar-message-response#' },
    400: {
      allOf: [
        { $ref: 'error#' },
        { type: 'object', properties: { kidFragment: { type: 'string' } } },
      ],
    },
  },
};

// A create_tenant message is stored only if every one of its keys is imported.
const receiveMessage = async (req) => {
  if (req.body.messageType !== 'create_tenant') {
    return storeMessage(req);
  }
  const importedKeys = await importTransferredKeys(
    get('payload.create_tenant.keys', req.body),
  );
  return storeMessage(req, { importedKeys });
};

const storeMessage = async (req, receipt) => {
  const { repos } = req;
  const vnfSignatureVerified = verifyVnfSignature(
    req.body,
    req.headers[VNF_SIGNATURE_HTTP_HEADER_NAME],
    req,
  );
  await repos.messages.insert({
    ...req.body,
    ...receipt,
    vnfSignatureVerified,
  });
};

// The ack to a test message declares the keys this receiver accepts.
const buildAck = ({ body, config }) =>
  omitBy(isNil, {
    messageType: 'ack',
    messageId: body.messageId,
    keyTransfer:
      body.messageType === 'test' ? config.registrarKeyTransfer : undefined,
  });
