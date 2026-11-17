const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { signAndEncodeBase64 } = require('@verii/crypto');
const { default: canonicalize } = require('canonicalize');
const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('Registrar webhook without a verification key', () => {
  const vnfHeaderSignatureSigningKey =
    'fc48dafb3d36ef0b5bb7663fb7fd571c950e0578016ef4cccba4d5e34c2aa15b';
  let fastify;
  let messagesCollection;

  before(async () => {
    fastify = buildFastify({ vnfHeaderSignatureVerificationKey: undefined });
    await fastify.ready();
    messagesCollection = mongoDb().collection('messages');
    await messagesCollection.deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  it('should store the message as not verified', async () => {
    const payload = { messageType: 'test', messageId: 'no-key' };
    const now = Date.now();
    const signature = signAndEncodeBase64(
      `${now}.${canonicalize(payload)}`,
      vnfHeaderSignatureSigningKey,
    );
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/registrar/registrar-webhook/',
      payload,
      headers: {
        'x-vnf-signature': `t=${now},v1=${signature}`,
      },
    });
    expect(response.json).toEqual({ messageId: 'no-key', messageType: 'ack' });
    const messageReceived = await messagesCollection.findOne({
      messageId: 'no-key',
    });
    expect(messageReceived).toEqual(
      expect.objectContaining({ vnfSignatureVerified: false }),
    );
  });
});
