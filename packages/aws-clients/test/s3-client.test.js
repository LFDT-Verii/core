/*
 * Copyright 2024 Velocity Team
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

const fs = require('fs').promises;
const path = require('path');
const {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { initS3Client } = require('../src/s3-client');

const deleteS3Object = async (s3Client, bucketName) => {
  const data = await s3Client.send(
    new ListObjectsCommand({ Bucket: bucketName })
  );

  // Check if data.Contents exists and is not empty
  if (data.Contents && data.Contents.length > 0) {
    const objects = data.Contents.map(({ Key }) => ({ Key }));
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects },
      })
    );
  }
};

describe('S3 client', () => {
  const bucket = 'mockedbucket';
  let originalS3Client;
  let client;
  beforeAll(async () => {
    client = initS3Client({
      awsRegion: 'us-west-1',
      awsEndpoint: 'http://localhost:4566',
      s3Bucket: bucket,
      secretAccessKey: 'ac_1',
      accessKeyId: 'aci_1',
      s3PresignedUrlExpiration: 1001,
      isTest: true,
    });
    originalS3Client = new S3Client({
      apiVersion: '2006-03-01',
      region: 'us-west-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'tests-key-id',
        secretAccessKey: 'tests-key',
      },
      endpoint: 'http://localhost:4566',
    });
    await originalS3Client.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  afterEach(async () => {
    await deleteS3Object(originalS3Client, bucket);
  });

  afterAll(async () => {
    await originalS3Client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  it('Should get signed url', async () => {
    const signedLink = await client.getSignedUrl({
      key: 'mocked_key',
      contentType: 'mocked_content_type',
    });

    expect(signedLink).toContain(
      'http://localhost:4566/mockedbucket/mocked_key?X-Amz-Algorithm=AWS4-HMAC-SHA256'
    );
  });

  it('Should get object', async () => {
    const file = await fs.readFile(
      `${path.dirname(__dirname)}/test/helpers/img.png`
    );
    await originalS3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: 'img.png',
        Body: file,
        ContentType: 'image/png',
      })
    );
    const object = await client.getObject({
      bucket,
      key: 'img.png',
    });
    expect(object).toBeDefined();
  });

  it('Should delete object', async () => {
    const file = await fs.readFile(
      `${path.dirname(__dirname)}/test/helpers/img.png`
    );
    await originalS3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: 'img.png',
        Body: file,
        ContentType: 'image/png',
      })
    );
    await client.deleteObject({
      bucket,
      key: 'img.png',
    });
    try {
      await client.getObject({
        bucket,
        key: 'img.png',
      });
      expect(true).toBeFalsy();
    } catch {
      expect(true).toBeTruthy();
    }
  });

  it('Should put object', async () => {
    const file = await fs.readFile(
      `${path.dirname(__dirname)}/test/helpers/img.png`
    );
    await client.putObject({
      bucket,
      key: 'img.png',
      body: file,
      contentType: 'image/png',
    });
    const object = await originalS3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: 'img.png',
      })
    );
    expect(object).toBeDefined();
  });
});
