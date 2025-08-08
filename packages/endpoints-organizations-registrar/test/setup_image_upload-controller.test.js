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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  testRegistrarSuperUser,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const buildFastify = require('./helpers/build-fastify');
const { ImageState } = require('../src/entities');

const baseUrl = '/api/v0.6/setup_image_upload';

describe('Organization setup image upload', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  beforeEach(async () => {
    await mongoDb().collection('images').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  it('Should upload a logo', async () => {
    const payload = {
      extension: 'png',
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      imageMetadata: {
        uploadUrl: expect.any(String),
        url: expect.stringMatching(
          /http:\/\/media.localhost.test\/400x400-[A-Za-z0-9_-]+.png/
        ),
        userId: testRegistrarSuperUser.sub,
        state: ImageState.PENDING_UPLOAD,
        uploadSucceeded: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    const expectedUrl = new URL(response.json.imageMetadata.uploadUrl);
    expect(expectedUrl.pathname).toEqual(
      expect.stringMatching(
        /\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.png/
      )
    );

    const image = await mongoDb().collection('images').find({}).toArray();
    expect(image).toEqual([
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.png/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('Should upload a logo with a different formats', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'png',
      },
    });
    const response1 = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'svg',
      },
    });
    const response2 = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'jpeg',
      },
    });
    const response3 = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'jpg',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response1.statusCode).toEqual(200);
    expect(response2.statusCode).toEqual(200);
    expect(response3.statusCode).toEqual(200);
    expect(response.json.imageMetadata.uploadUrl).toEqual(
      expect.stringMatching(
        // eslint-disable-next-line max-len
        /http:\/\/localhost:4566\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.png\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=xxx/
      )
    );
    expect(response1.json.imageMetadata.uploadUrl).toEqual(
      expect.stringMatching(
        // eslint-disable-next-line max-len
        /http:\/\/localhost:4566\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.png/
      )
    );
    expect(response2.json.imageMetadata.uploadUrl).toEqual(
      expect.stringMatching(
        // eslint-disable-next-line max-len
        /http:\/\/localhost:4566\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.jpeg/
      )
    );
    expect(response3.json.imageMetadata.uploadUrl).toEqual(
      expect.stringMatching(
        // eslint-disable-next-line max-len
        /http:\/\/localhost:4566\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.jpg/
      )
    );

    const images = await mongoDb().collection('images').find({}).toArray();
    expect(images).toEqual([
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.png/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.png/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.jpeg/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.jpg/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('Should return upload URL', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'jpeg',
      },
    });

    expect(response.json).toEqual({
      imageMetadata: {
        uploadUrl: expect.any(String),
        url: expect.stringMatching(
          /http:\/\/media.localhost.test\/400x400-[A-Za-z0-9_-]+.jpeg/
        ),
        userId: testRegistrarSuperUser.sub,
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    const expectedUrl = new URL(response.json.imageMetadata.uploadUrl);
    expect(expectedUrl.pathname).toEqual(
      expect.stringMatching(
        /\/mocked_bucket\/temporary\/400x400-[A-Za-z0-9_-]+.jpeg/
      )
    );

    const image = await mongoDb().collection('images').find({}).toArray();
    expect(image).toEqual([
      {
        _id: expect.any(ObjectId),
        userId: testRegistrarSuperUser.sub,
        key: expect.stringMatching(/400x400-[A-Za-z0-9_-]+.jpeg/),
        url: expect.any(String),
        uploadUrl: expect.any(String),
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('Should return error if extension invalid type', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'pdf',
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Bad Request',
        errorCode: 'request_validation_failed',
        message: 'body/extension must be equal to one of the allowed values',
        statusCode: 400,
      })
    );
  });

  it('Should return error if user has not sub', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: baseUrl,
      payload: {
        extension: 'jpg',
      },
      headers: {
        'x-override-oauth-user': JSON.stringify({
          noSub: 'mock',
          scope: 'admin:organizations',
        }),
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Unauthorized',
        errorCode: 'user_not_found',
        message: 'User not found',
        statusCode: 401,
      })
    );
  });
});
