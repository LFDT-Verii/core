const { initS3Client } = require('@verii/aws-clients');
const { values, isEmpty } = require('lodash/fp');
const newError = require('http-errors');
const { ExtensionTypes, getMimeType } = require('@verii/image-processing');
const { nanoid } = require('nanoid');
const {
  RegistrarScopes,
  ImageState,
  imageMetadataSchema,
} = require('../../entities');

const controller = async (fastify) => {
  const { mediaS3Bucket, mediaPutAccessKey, mediaPutAccessKeyId } =
    fastify.config;

  const s3Client = initS3Client({
    ...fastify.config,
    s3Bucket: mediaS3Bucket,
    secretAccessKey: mediaPutAccessKey,
    accessKeyId: mediaPutAccessKeyId,
  });

  fastify.post(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.AdminOrganizations,
        RegistrarScopes.WriteOrganizations,
      ]),
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.WriteOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        body: {
          type: 'object',
          properties: {
            extension: {
              type: 'string',
              enum: values(ExtensionTypes),
            },
          },
          required: ['extension'],
        },
        response: {
          200: imageMetadataSchema,
        },
      }),
    },
    async (req) => {
      const {
        user,
        body,
        repos,
        config: { mediaUrl },
      } = req;

      if (isEmpty(user?.sub)) {
        throw newError(401, 'User not found', {
          errorCode: 'user_not_found',
        });
      }

      const mime = getMimeType(body.extension);
      const key = generateLogoName({
        format: body.extension,
        height: 400,
        width: 400,
      });
      const url = await s3Client.getSignedUrl({
        key: `temporary/${key}`,
        contentType: mime,
      });
      const publicUrl = `${mediaUrl}/${key}`;
      const imageMetadata = await repos.images.insert({
        key,
        url: publicUrl,
        uploadUrl: url,
        userId: user.sub,
        uploadSucceeded: false,
        state: ImageState.PENDING_UPLOAD,
      });
      return {
        imageMetadata,
      };
    },
  );
};

const generateLogoName = ({ format, height, width }) => {
  const newImageFormat = format === 'svg' ? 'png' : format;
  return `${height}x${width}-${nanoid()}.${newImageFormat}`;
};

module.exports = controller;
