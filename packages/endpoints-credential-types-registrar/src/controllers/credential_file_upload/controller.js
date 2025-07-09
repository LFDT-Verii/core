const { values } = require('lodash/fp');
const multipart = require('@fastify/multipart');
const { initS3Client } = require('@verii/aws-clients');
const {
  CredentialTypeScopes,
  CredentialFileType,
  generateCredentialFileName,
  initValidateCredentialFile,
} = require('../../entities');

const controller = async (fastify) => {
  const { libS3Bucket } = fastify.config;
  const validateCredentialFile = initValidateCredentialFile(fastify);

  const s3Client = initS3Client({
    ...fastify.config,
    s3Bucket: libS3Bucket,
  });

  fastify.register(multipart, { attachFieldsToBody: 'keyValues' }).post(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        CredentialTypeScopes.AdminCredentialTypes,
        CredentialTypeScopes.WriteCredentialTypes,
      ]),
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              CredentialTypeScopes.AdminCredentialTypes,
              CredentialTypeScopes.WriteCredentialTypes,
            ],
          },
        ],
        body: {
          type: 'object',
          properties: {
            credentialFileType: {
              type: 'string',
              enum: values(CredentialFileType),
            },
            originalFilename: {
              type: 'string',
              minLength: 1,
            },
            file: {
              type: 'object',
            },
          },
          required: ['credentialFileType', 'originalFilename', 'file'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              fileMetadata: {
                type: 'object',
                properties: {
                  credentialFileType: {
                    type: 'string',
                    enum: values(CredentialFileType),
                  },
                  url: {
                    type: 'string',
                    format: 'uri',
                  },
                  userId: {
                    type: 'string',
                  },
                  createdAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['credentialFileType', 'url', 'userId', 'createdAt'],
                additionalProperties: false,
              },
            },
          },
        },
      }),
    },
    async (req) => {
      const {
        user,
        body,
        repos,
        config: { libUrl },
      } = req;
      const { credentialFileType, originalFilename, file } = body;

      validateCredentialFile(
        {
          file,
          credentialFileType,
        },
        req
      );

      const s3Key = generateCredentialFileName({
        originalFilename,
        credentialFileType,
      });
      const url = `${libUrl}/${s3Key}`;
      await s3Client.putObject({
        bucket: libS3Bucket,
        key: s3Key,
        contentType: 'application/json',
        body: file,
      });
      const credentialFileData = await repos.credentialFiles.insert({
        s3Key,
        userId: user.sub,
        credentialFileType,
        url,
      });
      return {
        fileMetadata: credentialFileData,
      };
    }
  );
};

module.exports = controller;
