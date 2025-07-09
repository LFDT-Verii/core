const modifyFeedSchema = require('./modify-feed.schema.json');

const addFeedSchema = {
  ...modifyFeedSchema,
  $id: 'https://velocitycareerlabs.io/add-feed.schema.json',
  title: 'modify-feed-body',
  description:
    'Schema that includes additionalProperties:false to prevent additional properties from being sent in the payload ',
  additionalProperties: false,
};

module.exports = {
  addFeedSchema,
};
