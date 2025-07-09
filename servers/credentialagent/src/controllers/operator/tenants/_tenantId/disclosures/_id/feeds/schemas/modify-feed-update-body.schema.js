const { omit, pull } = require('lodash/fp');
const modifyFeedSchema = require('./modify-feed.schema.json');

const modifyFeedUpdateBodySchema = {
  ...modifyFeedSchema,
  $id: 'https://velocitycareerlabs.io/modify-feed-update-body.schema.json',
  title: 'modify-feed-body',
  description:
    // eslint-disable-next-line max-len
    'Schema that includes additionalProperties:false to prevent additional properties from being sent in the payload and prevents vendorUserId from being updated',
  additionalProperties: false,
  properties: omit(['vendorUserId'])(modifyFeedSchema.properties),
  required: pull('vendorUserId')(modifyFeedSchema.required),
};

module.exports = {
  modifyFeedUpdateBodySchema,
};
