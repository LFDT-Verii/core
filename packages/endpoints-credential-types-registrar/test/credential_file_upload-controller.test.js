/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} = require('node:test');
const { expect } = require('expect');

mock.module('nanoid', {
  namedExports: {
    nanoid: () => '1234',
  },
});

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const FormData = require('form-data');
const path = require('path');
const {
  deleteS3Object,
  getObject,
  testRegistrarUser,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const fs = require('fs').promises;
const {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const { ObjectId } = require('mongodb');
const buildFastify = require('./helpers/build-fastify');

const baseUrl = '/api/v0.6/credential_file_upload';

describe(
  'Organization setup credential file upload',
  { timeout: 20000 },
  () => {
    let fastify;
    const libS3Bucket = 'lib-bucket';
    let s3Client;

    before(async () => {
      s3Client = new S3Client({
        apiVersion: '2006-03-01',
        region: process.env.AWS_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'tests-key-id',
          secretAccessKey: 'tests-key',
        },
        endpoint: process.env.AWS_ENDPOINT,
      });

      try {
        await deleteS3Object(s3Client, libS3Bucket);
        // delete in case after never was called
        await s3Client.send(new DeleteBucketCommand({ Bucket: libS3Bucket }));
      } catch (err) {
        // ignore
        console.error(err);
      }
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: libS3Bucket }));
      } catch (err) {
        console.error(err);
        // ignore
      }

      fastify = buildFastify((server) => {
        // eslint-disable-next-line better-mutation/no-mutation
        server.injectMultipart = async ({
          method,
          url,
          user,
          payload,
          headers,
        }) => {
          const form = new FormData();
          // eslint-disable-next-line no-restricted-syntax, guard-for-in
          for (const key in payload) {
            form.append(key, payload[key]);
          }
          const httpHeaders = {
            'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
            'x-override-oauth-user': JSON.stringify(user),
            ...headers,
          };

          return server.inject({
            method,
            url,
            payload: form.getBuffer(),
            headers: httpHeaders,
          });
        };
        return server;
      });
      await fastify.ready();
    });

    beforeEach(async () => {
      await mongoDb().collection('credentialFiles').deleteMany({});
    });

    afterEach(async () => {
      await deleteS3Object(s3Client, libS3Bucket);
    });

    after(async () => {
      await fastify.close();
      await s3Client.send(new DeleteBucketCommand({ Bucket: libS3Bucket }));
      mock.reset();
    });

    it('Should return upload URL', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'JsonSchema',
          originalFilename: 'email-v1.0.schema.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/schemas/[A-Za-z0-9_-]+-email-v1.0.schema.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'JsonSchema',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'schemas/[A-Za-z0-9_-]+-email-v1.0.schema.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/schemas/[A-Za-z0-9_-]+-email-v1.0.schema.json'
          ),
          credentialFileType: 'JsonSchema',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: credentialFile[0].s3Key,
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should return DisplayDescriptor credentialFileType', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'DisplayDescriptor',
          originalFilename: 'email-v1.0.descriptor.json',
          file: await fs.readFile(
            `${path.dirname(
              __dirname
            )}/test/data/display-descriptor.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: expect.stringMatching(
          'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
        ),
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should 400 if label is missing', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'DisplayDescriptor',
          originalFilename: 'email-v1.0.descriptor.json',
          file: await fs.readFile(
            `${path.dirname(
              __dirname
            )}/test/data/display-descriptor.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: expect.stringMatching(
          'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
        ),
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should validate display descriptor with a few properties', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'DisplayDescriptor',
          originalFilename: 'email-v1.0.descriptor.json',
          file: await fs.readFile(
            `${path.dirname(
              __dirname
            )}/test/data/certification-v1.1.descriptor.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
          ),
          credentialFileType: 'DisplayDescriptor',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: expect.stringMatching(
          'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json'
        ),
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should return FormSchema credentialFileType', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'FormSchema',
          originalFilename: 'email-v1.0.form-schema.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/form-schemas/[A-Za-z0-9_-]+-email-v1.0.form-schema.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'FormSchema',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'form-schemas/[A-Za-z0-9_-]+-email-v1.0.form-schema.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/form-schemas/[A-Za-z0-9_-]+-email-v1.0.form-schema.json'
          ),
          credentialFileType: 'FormSchema',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: expect.stringMatching(
          'form-schemas/[A-Za-z0-9_-]+-email-v1.0.form-schema.json'
        ),
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should return JsonldContext credentialFileType', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'JsonldContext',
          originalFilename: 'email-v1.0.jsonld.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual({
        fileMetadata: {
          url: expect.stringMatching(
            'http://lib.localhost.test/contexts/[A-Za-z0-9_-]+-email-v1.0.jsonld.json'
          ),
          userId: testRegistrarUser.sub,
          credentialFileType: 'JsonldContext',
          createdAt: expect.any(String),
        },
      });
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([
        {
          _id: expect.any(ObjectId),
          userId: testRegistrarUser.sub,
          s3Key: expect.stringMatching(
            'contexts/[A-Za-z0-9_-]+-email-v1.0.jsonld.json'
          ),
          url: expect.stringMatching(
            'http://lib.localhost.test/contexts/[A-Za-z0-9_-]+-email-v1.0.jsonld.json'
          ),
          credentialFileType: 'JsonldContext',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);

      const s3Obj = await getObject({
        s3Client,
        key: expect.stringMatching(
          'contexts/[A-Za-z0-9_-]+-email-v1.0.jsonld.json'
        ),
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeDefined();
    });

    it('Should 400 if credentialFileType invalid type', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'not-valid',
          originalFilename: 'email-v1.0.jsonld.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/credentialFileType must be equal to one of the allowed values',
          statusCode: 400,
        })
      );
    });

    it('Should 400 if originalFilename is empty', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'JsonldContext',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'originalFilename'",
          statusCode: 400,
        })
      );
    });

    it('Should 400 if originalFilename is empty string', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'JsonldContext',
          originalFilename: '',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/originalFilename must NOT have fewer than 1 characters',
          statusCode: 400,
        })
      );
    });

    it('Should 400 if user has not sub', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'FormSchema',
          originalFilename: 'email-v1.0.form-schema.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/data/example.schema.json`
          ),
        },
        headers: {
          'x-override-oauth-unauthorized': true,
        },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'missing_error_code',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });

    it('Should 400 if json is invalid', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'FormSchema',
          originalFilename: 'email-v1.0.form-schema.json',
          file: await fs.readFile(
            `${path.dirname(__dirname)}/test/helpers/build-fastify.js`
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invalid_json',
          message: 'Invalid JSON',
          statusCode: 400,
        })
      );
    });

    it('Should 400 if DisplayDescriptor credentialFileType file invalid', async () => {
      const response = await fastify.injectMultipart({
        method: 'POST',
        url: baseUrl,
        user: testRegistrarUser,
        payload: {
          credentialFileType: 'DisplayDescriptor',
          originalFilename: 'email-v1.0.descriptor.json',
          file: await fs.readFile(
            `${path.dirname(
              __dirname
            )}/test/data/invalid-display-descriptor.schema.json`
          ),
        },
      });

      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'file_validation_error',
          message: "must have required property 'title'",
          statusCode: 400,
        })
      );
      const credentialFile = await mongoDb()
        .collection('credentialFiles')
        .find({})
        .toArray();
      expect(credentialFile).toEqual([]);

      const s3Obj = await getObject({
        s3Client,
        s3Key: 'display-descriptors/[A-Za-z0-9_-]+-email-v1.0.descriptor.json',
        bucket: libS3Bucket,
      });
      expect(s3Obj).toBeNull();
    });
  }
);
