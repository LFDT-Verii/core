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
const { errorResponseMatcher } = require('@verii/tests-helpers');
const initImageFactory = require('../src/entities/images/factories/images-factory');
const buildFastify = require('./helpers/build-fastify');
const { ImageState } = require('../src/entities');

const baseUrl = '/api/v0.6/image_upload';

describe('Organization image upload', () => {
  let fastify;
  let persistImage;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistImage } = initImageFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('images').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  it('Should return error if image not found', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/${encodeURIComponent(
        'http://media.localhost.test/400x400-1234.png',
      )}`,
      headers: {
        'x-override-oauth-user': JSON.stringify({
          sub: '1234',
          scope: 'admin:organizations',
        }),
      },
    });

    expect(response.statusCode).toEqual(404);
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Not Found',
        errorCode: 'image_not_found',
        message: 'Image not found',
        statusCode: 404,
      }),
    );
  });

  it('Should return image metadata', async () => {
    const image = await persistImage();

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/${encodeURIComponent(image.url)}`,
      headers: {
        'x-override-oauth-user': JSON.stringify({
          sub: image.userId,
          scope: 'admin:organizations',
        }),
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      imageMetadata: {
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        url: image.url,
        uploadUrl: image.uploadUrl,
        userId: image.userId,
        state: ImageState.PENDING_UPLOAD,
        uploadSucceeded: false,
      },
    });
  });

  it('Should return image metadata with processing result', async () => {
    const image = await persistImage({
      errorCode: 'invalid_image',
      state: ImageState.ERROR,
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/${encodeURIComponent(image.url)}`,
      headers: {
        'x-override-oauth-user': JSON.stringify({
          sub: image.userId,
          scope: 'admin:organizations',
        }),
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      imageMetadata: {
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        url: image.url,
        uploadUrl: image.uploadUrl,
        userId: image.userId,
        errorCode: 'invalid_image',
        state: ImageState.ERROR,
        uploadSucceeded: false,
      },
    });
  });

  it('Should return activated image metadata', async () => {
    const image = await persistImage({
      activateAt: new Date(),
      state: ImageState.ACTIVE,
      uploadSucceeded: true,
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/${encodeURIComponent(image.url)}`,
      headers: {
        'x-override-oauth-user': JSON.stringify({
          sub: image.userId,
          scope: 'admin:organizations',
        }),
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      imageMetadata: {
        activateAt: image.activateAt,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        url: image.url,
        uploadUrl: image.uploadUrl,
        state: ImageState.ACTIVE,
        userId: image.userId,
        uploadSucceeded: true,
      },
    });
  });
});
