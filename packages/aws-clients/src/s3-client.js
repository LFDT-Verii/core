/**
 * Copyright 2023 Velocity Team
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
 */

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  getSignedUrl: awsGetSignedUrl,
} = require('@aws-sdk/s3-request-presigner');
const { buildClientConfig } = require('./client-config');

const initS3Client = ({
  awsRegion,
  awsEndpoint,
  s3Bucket,
  accessKeyId,
  secretAccessKey,
  s3PresignedUrlExpiration,
  isTest,
}) => {
  const s3Client = new S3Client({
    ...buildClientConfig({
      apiVersion: '2006-03-01',
      awsRegion,
      awsEndpoint,
      accessKeyId,
      secretAccessKey,
    }),
    forcePathStyle: isTest,
    signatureVersion: 'v4',
  });

  const getSignedUrl = async ({ key, contentType, metadata }) => {
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    });

    return awsGetSignedUrl(s3Client, command, {
      expiresIn: s3PresignedUrlExpiration,
    });
  };

  const getObject = async ({ bucket, key }) => {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const result = await s3Client.send(command);
    const body = await result.Body.transformToByteArray();

    return {
      ...result,
      Body: body,
    };
  };

  const putObject = async ({ bucket, key, body, contentType, metadata }) => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    await s3Client.send(command);
  };

  const deleteObject = async ({ bucket, key }) => {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
  };

  return {
    getObject,
    putObject,
    getSignedUrl,
    deleteObject,
  };
};

module.exports = {
  initS3Client,
};
