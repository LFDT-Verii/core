const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { map, omit, partition, toPairs } = require('lodash/fp');
const {
  generateKeyPair,
  hexFromJwk,
  signAndEncodeBase64,
} = require('@verii/crypto');
const { keyTransferConformanceVectors } = require('@verii/sample-data');
const { ObjectId } = require('mongodb');
const { default: canonicalize } = require('canonicalize');
const buildFastify = require('./helpers/mockvendor-build-fastify');

describe('Registrar messages controller tests', () => {
  const vnfHeaderSignatureSigningKey =
    'fc48dafb3d36ef0b5bb7663fb7fd571c950e0578016ef4cccba4d5e34c2aa15b';
  const [acceptedVectors, rejectedVectors] = partition(
    'expected.accepted',
    map(
      ([name, vector]) => ({ name, ...vector }),
      toPairs(keyTransferConformanceVectors),
    ),
  );
  let fastify;
  let messagesCollection;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    messagesCollection = mongoDb().collection('messages');
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    await messagesCollection.deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  const postMessage = (url, payload, headers) =>
    fastify.injectJson({ method: 'POST', url, payload, headers });

  const expectImported = async ({ message, expected }, response) => {
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      messageId: message.messageId,
      messageType: 'ack',
    });
    expect(
      await messagesCollection.findOne({ messageId: message.messageId }),
    ).toEqual({
      ...message,
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      importedKeys: expected.keys,
      updatedAt: expect.any(Date),
      vnfSignatureVerified: false,
    });
  };

  const expectRejected = async ({ message, expected }, response) => {
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual({
      error: 'Bad Request',
      errorCode: expected.errorCode,
      kidFragment: expected.kidFragment,
      message: expect.stringContaining(expected.kidFragment),
      requestId: expect.any(String),
      statusCode: 400,
    });
    expect(
      await messagesCollection.countDocuments({ messageId: message.messageId }),
    ).toEqual(0);
  };

  describe('Registrar webhook test suite', () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });
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
              key: hexFromJwk(privateKey),
              publicKey: hexFromJwk(privateKey, false),
              algorithm: 'SECP256K1',
              encoding: 'hex',
            },
          ],
        },
      },
    };
    const importedKeys = [
      {
        kidFragment: '#-a-123',
        importedFrom: 'hex',
        publicJwk: omit(['d'], privateKey),
      },
    ];

    it('should receive secure messaging from api', async () => {
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey,
      );
      const response = await postMessage(
        '/registrar/registrar-webhook/',
        payload,
        { 'x-vnf-signature': `t=${now},v1=${signature}` },
      );
      expect(response.json).toEqual({
        messageId: '123',
        messageType: 'ack',
      });
      const messageReceived = await messagesCollection.findOne({
        messageId: '123',
      });
      expect(messageReceived).toEqual({
        ...payload,
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        importedKeys,
        updatedAt: expect.any(Date),
        vnfSignatureVerified: true,
      });
    });
    it('should receive secure messaging from api with bad signature', async () => {
      const now = Date.now();

      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey,
      );
      const response = await postMessage(
        '/registrar/registrar-webhook/',
        { ...payload, messageId: '456' },
        { 'x-vnf-signature': `t=${now},v1=${signature}` },
      );
      expect(response.json).toEqual({
        messageId: '456',
        messageType: 'ack',
      });
      const messageReceived = await messagesCollection.findOne({
        messageId: '456',
      });
      expect(messageReceived).toEqual({
        ...payload,
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        importedKeys,
        messageId: '456',
        updatedAt: expect.any(Date),
        vnfSignatureVerified: false,
      });
    });
    it('should return 400 with incorrect payload', async () => {
      const response = await postMessage('/registrar/registrar-webhook/', {
        messageType: 'bla',
        messageId: '123',
      });
      expect(response.json).toEqual({
        error: 'Bad Request',
        errorCode: 'request_validation_failed',
        message: 'body/messageType must be equal to one of the allowed values',
        requestId: expect.any(String),
        statusCode: 400,
      });
    });
  });
  describe('Registrar webhook conformance vectors test suite', () => {
    acceptedVectors.forEach((vector) => {
      it(`should import the keys of the ${vector.name} vector`, async () => {
        const response = await postMessage(
          '/registrar/registrar-webhook/',
          vector.message,
        );

        await expectImported(vector, response);
      });
    });

    rejectedVectors.forEach((vector) => {
      it(`should reject the ${vector.name} vector and store nothing`, async () => {
        const response = await postMessage(
          '/registrar/registrar-webhook/',
          vector.message,
        );

        await expectRejected(vector, response);
      });
    });
  });
  describe('Registrar webhook key import test suite', () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });
    const { privateKey: otherPrivateKey } = generateKeyPair({ format: 'jwk' });
    const { privateKey: validPrivateKey } = generateKeyPair({ format: 'jwk' });
    const dltKey = {
      kidFragment: '#eth-account-key-1',
      algorithm: 'SECP256K1',
      purposes: ['DLT_TRANSACTIONS'],
    };
    const validKey = {
      kidFragment: '#vc-signing-key-1',
      algorithm: 'SECP256K1',
      purposes: ['ISSUING_METADATA'],
      encoding: 'jwk',
      jwk: validPrivateKey,
      publicJwk: omit(['d'], validPrivateKey),
    };
    const createTenantMessage = (messageId, keys) => ({
      messageType: 'create_tenant',
      messageId,
      payload: {
        caoDid: 'did:123',
        create_tenant: { did: 'did:321', serviceIds: ['1'], keys },
      },
    });

    const invalidKeys = [
      {
        description: 'a private key that is not secp256k1 hex',
        key: {
          ...dltKey,
          encoding: 'hex',
          key: 'not-a-hex-key',
          publicKey: hexFromJwk(privateKey, false),
        },
        errorCode: 'private_key_invalid',
      },
      {
        description: 'a private key sent as the public key',
        key: {
          ...dltKey,
          encoding: 'hex',
          key: hexFromJwk(privateKey),
          publicKey: hexFromJwk(privateKey),
        },
        errorCode: 'public_key_invalid',
      },
      {
        description: 'no private key',
        key: {
          ...dltKey,
          encoding: 'hex',
          publicKey: hexFromJwk(privateKey, false),
        },
        errorCode: 'private_key_not_found',
      },
      {
        description: 'a hex public key of another key',
        key: {
          ...dltKey,
          encoding: 'hex',
          key: hexFromJwk(privateKey),
          publicKey: hexFromJwk(otherPrivateKey, false),
        },
        errorCode: 'public_key_not_matched',
      },
      {
        description: 'a public JWK of another key',
        key: {
          ...dltKey,
          encoding: 'jwk',
          jwk: privateKey,
          publicJwk: omit(['d'], otherPrivateKey),
        },
        errorCode: 'public_key_not_matched',
      },
      {
        description: 'a JWK whose x and y belong to another key',
        key: {
          ...dltKey,
          encoding: 'jwk',
          jwk: { ...otherPrivateKey, d: privateKey.d },
        },
        errorCode: 'public_key_not_matched',
      },
    ];

    invalidKeys.forEach(({ description, key, errorCode }) => {
      it(`should return 400 ${errorCode} for ${description} and store nothing`, async () => {
        const message = createTenantMessage('invalid-key', [validKey, key]);

        const response = await postMessage(
          '/registrar/registrar-webhook/',
          message,
        );

        await expectRejected(
          { message, expected: { errorCode, kidFragment: dltKey.kidFragment } },
          response,
        );
      });
    });

    it('should return 400 for a P-256 key sent as hex', async () => {
      const { privateKey: p256PrivateKey } = generateKeyPair({
        format: 'jwk',
        curve: 'P-256',
      });

      const response = await postMessage(
        '/registrar/registrar-webhook/',
        createTenantMessage('es256-hex', [
          {
            kidFragment: '#exchange-key-1',
            purposes: ['EXCHANGES'],
            algorithm: 'ES256',
            encoding: 'hex',
            key: hexFromJwk(p256PrivateKey),
            publicKey: hexFromJwk(p256PrivateKey, false),
          },
        ]),
      );

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        expect.objectContaining({ errorCode: 'request_validation_failed' }),
      );
      expect(
        await messagesCollection.countDocuments({ messageId: 'es256-hex' }),
      ).toEqual(0);
    });
  });
  describe('Registrar webhook key transfer declaration test suite', () => {
    const declarations = [
      { description: 'no declaration', keyTransfer: undefined },
      {
        description: 'hex and jwk encodings',
        keyTransfer: { encodings: ['hex', 'jwk'] },
      },
      { description: 'the jwk encoding', keyTransfer: { encodings: ['jwk'] } },
      {
        description: 'the ES256 algorithm',
        keyTransfer: {
          algorithms: ['SECP256K1', 'ES256'],
          encodings: ['hex', 'jwk'],
        },
      },
    ];

    declarations.forEach(({ description, keyTransfer }) => {
      it(`should declare ${description} in the ack to a test message`, async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          registrarKeyTransfer: keyTransfer,
        });

        const response = await postMessage('/registrar/registrar-webhook/', {
          messageType: 'test',
          messageId: 'test-1',
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toStrictEqual({
          messageId: 'test-1',
          messageType: 'ack',
          ...(keyTransfer == null ? {} : { keyTransfer }),
        });
        expect(
          await messagesCollection.findOne({ messageId: 'test-1' }),
        ).toEqual({
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          messageId: 'test-1',
          messageType: 'test',
          updatedAt: expect.any(Date),
          vnfSignatureVerified: false,
        });
      });
    });

    it('should not declare key transfer capabilities in the ack to a create_tenant message', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        registrarKeyTransfer: { encodings: ['jwk'] },
      });
      const [vector] = acceptedVectors;

      const response = await postMessage(
        '/registrar/registrar-webhook/',
        vector.message,
      );

      expect(response.json).toStrictEqual({
        messageId: vector.message.messageId,
        messageType: 'ack',
      });
    });
  });
  describe('Registrar webhook delay test suite', () => {
    it('should receive secure messaging from api with 30 second delay', async () => {
      const keyTransfer = { encodings: ['hex', 'jwk'] };
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        registrarKeyTransfer: keyTransfer,
      });
      const payload = { messageType: 'test', messageId: '123' };
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey,
      );
      const response = await postMessage(
        '/registrar/registrar-webhook-delay/',
        payload,
        { 'x-vnf-signature': `t=${now},v1=${signature}` },
      );
      expect(response.json).toEqual({
        messageId: '123',
        messageType: 'ack',
        keyTransfer,
      });
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
    });

    it('should import or reject every conformance vector after the delay', async () => {
      const post = (vector) =>
        postMessage('/registrar/registrar-webhook-delay/', vector.message);

      await Promise.all([
        ...map(
          async (vector) => expectImported(vector, await post(vector)),
          acceptedVectors,
        ),
        ...map(
          async (vector) => expectRejected(vector, await post(vector)),
          rejectedVectors,
        ),
      ]);
    });

    it('should return 400 with incorrect payload delay', async () => {
      const response = await postMessage(
        '/registrar/registrar-webhook-delay/',
        { messageType: 'bla', messageId: '123' },
      );
      expect(response.json).toEqual({
        error: 'Bad Request',
        errorCode: 'request_validation_failed',
        message: 'body/messageType must be equal to one of the allowed values',
        requestId: expect.any(String),
        statusCode: 400,
      });
    });
  });
  describe('Registrar webhook bad protocal test suite', () => {
    it('should return foo with bad endpoint protocol', async () => {
      const payload = { messageType: 'create_tenant', messageId: '123' };
      const now = Date.now();
      const signature = signAndEncodeBase64(
        `${now}.${canonicalize(payload)}`,
        vnfHeaderSignatureSigningKey,
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
