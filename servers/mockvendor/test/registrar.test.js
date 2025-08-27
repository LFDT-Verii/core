const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { signAndEncodeBase64 } = require('@verii/crypto');
const { ObjectId } = require('mongodb');
const canonicalize = require('canonicalize');
const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('Registrar messages controller tests', () => {
  const vnfHeaderSignatureSigningKey =
    'fc48dafb3d36ef0b5bb7663fb7fd571c950e0578016ef4cccba4d5e34c2aa15b';
  let fastify;
  let messagesCollection;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    messagesCollection = mongoDb().collection('messages');
  });

  beforeEach(async () => {
    await messagesCollection.deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });
  describe('Registrar webhook test suite', () => {
    it('should receive secure messaging from api', async () => {
      const payload = {
        messageType: 'create_tenant',
        messageId: '123',
        payload: {
          caoDid: 'did:123',
          caoService: {
            id: 'did:velocity:12',
            type: 'VlcIdDocumentIssuer_v1',
            serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
          },
          create_tenant: {
            did: 'did:321',
            serviceIds: ['1', '2'],
            keys: [
              {
                kidFragment: '#-a-123',
                purposes: ['DLT'],
                key: '123',
                publicKey: '345',
                algorithm: 'SECP256K1',
                encoding: 'hex',
              },
            ],
          },
        },
      };
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook/',
        payload,
        headers: {
          'x-vnf-signature': `t=${now},v1=${signature}`,
        },
      });
      expect(response.json).toEqual({
        messageId: '123',
        messageType: 'ack',
      });
      const messageReceived = await messagesCollection.findOne({
        messageId: '123',
      });
      expect(messageReceived).toEqual({
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        messageId: '123',
        messageType: 'create_tenant',
        payload: {
          caoDid: 'did:123',
          caoService: {
            id: 'did:velocity:12',
            type: 'VlcIdDocumentIssuer_v1',
            serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
          },
          create_tenant: {
            did: 'did:321',
            serviceIds: ['1', '2'],
            keys: [
              {
                kidFragment: '#-a-123',
                purposes: ['DLT'],
                key: '123',
                publicKey: '345',
                algorithm: 'SECP256K1',
                encoding: 'hex',
              },
            ],
          },
        },
        updatedAt: expect.any(Date),
        vnfSignatureVerified: true,
      });
    });
    it('should receive secure messaging from api with bad signature', async () => {
      const payload = {
        messageType: 'create_tenant',
        messageId: '123',
        payload: {
          caoDid: 'did:123',
          caoService: {
            id: 'did:velocity:12',
            type: 'VlcIdDocumentIssuer_v1',
            serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
          },
          create_tenant: {
            did: 'did:321',
            serviceIds: ['1', '2'],
            keys: [
              {
                kidFragment: '#-a-123',
                purposes: ['DLT'],
                key: '123',
                publicKey: '345',
                algorithm: 'SECP256K1',
                encoding: 'hex',
              },
            ],
          },
        },
      };
      const now = Date.now();

      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook/',
        payload: {
          ...payload,
          messageId: '456',
        },
        headers: {
          'x-vnf-signature': `t=${now},v1=${signature}`,
        },
      });
      expect(response.json).toEqual({
        messageId: '456',
        messageType: 'ack',
      });
      const messageReceived = await messagesCollection.findOne({
        messageId: '456',
      });
      expect(messageReceived).toEqual({
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        messageId: '456',
        messageType: 'create_tenant',
        payload: {
          caoDid: 'did:123',
          caoService: {
            id: 'did:velocity:12',
            type: 'VlcIdDocumentIssuer_v1',
            serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
          },
          create_tenant: {
            did: 'did:321',
            serviceIds: ['1', '2'],
            keys: [
              {
                kidFragment: '#-a-123',
                purposes: ['DLT'],
                key: '123',
                publicKey: '345',
                algorithm: 'SECP256K1',
                encoding: 'hex',
              },
            ],
          },
        },
        updatedAt: expect.any(Date),
        vnfSignatureVerified: false,
      });
    });
    it('should return 400 with incorrect payload', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook/',
        payload: { messageType: 'bla', messageId: '123' },
      });
      expect(response.json).toEqual({
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'body/messageType must be equal to one of the allowed values',
        statusCode: 400,
      });
    });
  });
  describe('Registrar webhook delay test suite', () => {
    it('should receive secure messaging from api with 30 second delay', async () => {
      const payload = { messageType: 'test', messageId: '123' };
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook-delay/',
        payload,
        headers: {
          'x-vnf-signature': `t=${now},v1=${signature}`,
        },
      });
      expect(response.json).toEqual({ messageId: '123', messageType: 'ack' });
      const messageReceived = await messagesCollection.findOne({
        messageId: '123',
      });
      expect(messageReceived).toEqual({
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        messageId: '123',
        messageType: 'test',
        updatedAt: expect.any(Date),
        vnfSignatureVerified: true,
      });
    }, 40000);

    it('should return 400 with incorrect payload delay', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook-delay/',
        payload: { messageType: 'bla', messageId: '123' },
      });
      expect(response.json).toEqual({
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'body/messageType must be equal to one of the allowed values',
        statusCode: 400,
      });
    }, 40000);
  });
  describe('Registrar webhook bad protocal test suite', () => {
    it('should return foo with bad endpoint protocol', async () => {
      const payload = { messageType: 'create_tenant', messageId: '123' };
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook-bad-protocol/',
        payload,
        headers: {
          'x-vnf-signature': `t=${now},v1=${signature}`,
        },
      });
      expect(response.json).toEqual({ foo: 'foo' });
    });
    it('should return 400 with bad payload protocol', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/registrar/registrar-webhook-bad-protocol/',
        payload: { messageType: 'bla', messageId: '123' },
      });
      expect(response.json).toEqual({
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'body/messageType must be equal to one of the allowed values',
        statusCode: 400,
      });
    });
  });
});
