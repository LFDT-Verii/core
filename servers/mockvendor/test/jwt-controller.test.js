const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const { generateKeyPair } = require('@verii/crypto');
const { jwtVerify, jwtSign } = require('@verii/jwt');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const { generateJwk } = require('../src/entities');

describe('JWT Controller Test Suite', () => {
  let fastify;

  before(async () => {
    fastify = await buildFastify({});
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  describe('JWT signing and verifying', () => {
    const api = '/api/jwt';

    describe('sign jwt test suite', () => {
      it('should fail to sign a jwt with missing payload in body', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              code: 'FST_ERR_VALIDATION',
              message: "body must have required property 'payload'",
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should fail to sign a jwt with empty keyId in options', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {},
            options: {
              keyId: '',
            },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              code: 'FST_ERR_VALIDATION',
              message:
                // eslint-disable-next-line max-len
                "body/options must have required property 'kid', body/options/keyId must NOT have fewer than 1 characters, body/options must match exactly one schema in oneOf",
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should fail to sign a jwt with empty kid in options', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {},
            options: {
              kid: '',
            },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              code: 'FST_ERR_VALIDATION',
              message:
                // eslint-disable-next-line max-len
                "body/options/kid must NOT have fewer than 1 characters, body/options must have required property 'keyId', body/options must match exactly one schema in oneOf",
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should fail when a key pair could not be found by kid', async () => {
        const { publicKey: pubK } = generateKeyPair({
          curve: 'P-256',
          format: 'jwk',
        });
        const didJwk = getDidUriFromJwk(pubK);
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {
              abc: 'abv',
            },
            options: {
              kid: `${didJwk}#0`,
            },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              message: 'Key pair not found',
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should fail when a key pair could not be found by keyId', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {
              abc: 'abv',
            },
            options: {
              keyId: '111',
            },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              message: 'Key pair not found',
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should sign a jwt with keyId', async () => {
        const keyPair = generateJwk('P-256');
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {
              abc: 'abv',
            },
            options: {
              keyId: keyPair.id,
            },
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          compactJwt: expect.any(String),
        });

        const { payload, header } = await jwtVerify(
          response.json.compactJwt,
          keyPair.privateKey
        );
        expect(payload.abc).toEqual('abv');
        expect(header.jwk).toEqual(keyPair.publicKey);
      });

      it('should sign a jwt with kid & secp256k1', async () => {
        const keyPair = generateJwk('secp256k1');
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/sign`,
          payload: {
            header: {},
            payload: {
              abc: 'abv',
            },
            options: {
              kid: keyPair.kid,
            },
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          compactJwt: expect.any(String),
        });

        const { payload, header } = await jwtVerify(
          response.json.compactJwt,
          keyPair.privateKey
        );
        expect(payload.abc).toEqual('abv');
        expect(header.jwk).toEqual(keyPair.publicKey);
      });
    });

    describe('verify jwt test suite', () => {
      it('should 400 with missing jwt in body', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/verify`,
          payload: {},
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher(
            {
              error: 'Bad Request',
              code: 'FST_ERR_VALIDATION',
              message: "body must have required property 'jwt'",
              statusCode: 400,
            },
            { omits: ['requestId', 'errorCode'] }
          )
        );
      });

      it('should not verify a jwt with incorrect jwk embedded in the header', async () => {
        const { privateKey } = generateKeyPair({ format: 'jwk' });
        const { publicKey: wrongPublicKey } = generateKeyPair({
          format: 'jwk',
        });
        const jwt = await jwtSign({ foo: 'bar' }, privateKey, {
          jwk: wrongPublicKey,
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/verify`,
          payload: {
            jwt,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          verified: false,
          error:
            'JWSSignatureVerificationFailed: signature verification failed',
        });
      });

      it('should not verify a jwt with incorrect publicKey', async () => {
        const { privateKey } = generateKeyPair({ format: 'jwk' });
        const { publicKey: wrongPublicKey } = generateKeyPair({
          format: 'jwk',
        });
        const jwt = await jwtSign({ foo: 'bar' }, privateKey);
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/verify`,
          payload: {
            jwt,
            publicKey: wrongPublicKey,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          verified: false,
          error:
            'JWSSignatureVerificationFailed: signature verification failed',
        });
      });

      it('should verify a jwt with correct jwk embedded in the header', async () => {
        const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
        const jwt = await jwtSign({ foo: 'bar' }, privateKey, {
          jwk: publicKey,
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/verify`,
          payload: {
            jwt,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          verified: true,
        });
      });

      it('should verify a jwt with correct publicKey', async () => {
        const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
        const jwt = await jwtSign({ foo: 'bar' }, privateKey);
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${api}/verify`,
          payload: {
            jwt,
            publicKey,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          verified: true,
        });
      });
    });
  });
});
