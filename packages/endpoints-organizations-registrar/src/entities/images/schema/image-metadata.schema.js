const { values } = require('lodash/fp');
const { ImageState } = require('../domain');

const imageMetadataSchema = {
  title: 'image-metadata',
  $id: 'https://velocitycareerlabs.io/image-metadata.schema.json',
  type: 'object',
  description: 'Image metadata schema',
  properties: {
    imageMetadata: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
        },
        userId: {
          type: 'string',
        },
        uploadUrl: {
          type: 'string',
        },
        state: {
          type: 'string',
          enum: values(ImageState),
        },
        uploadSucceeded: {
          type: 'boolean',
        },
        errorCode: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
        },
        activateAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      required: [
        'url',
        'userId',
        'state',
        'uploadSucceeded',
        'createdAt',
        'updatedAt',
      ],
    },
  },
  required: ['imageMetadata'],
};

module.exports = { imageMetadataSchema };
