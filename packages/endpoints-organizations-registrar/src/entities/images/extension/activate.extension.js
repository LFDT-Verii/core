const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const { ImageState } = require('../domain');

const activateExtension = (parent) => ({
  activate: async (url) => {
    const image = await parent.findOne({
      filter: {
        url,
      },
    });
    if (isEmpty(image)) {
      return;
    }
    if (image.state === ImageState.ACTIVE) {
      throw newError(400, 'Image already active', {
        errorCode: 'image_already_active',
      });
    }
    const current = new Date();
    await parent.collection().updateOne(
      { url },
      {
        $set: {
          activatedAt: current,
          updatedAt: current,
          state: ImageState.ACTIVE,
        },
      }
    );
  },
  extensions: parent.extensions.concat(['activate']),
});

module.exports = { activateExtension };
