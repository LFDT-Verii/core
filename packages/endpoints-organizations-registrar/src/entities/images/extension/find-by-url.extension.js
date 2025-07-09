const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');

const findByUrlExtension = (parent) => ({
  findByUrl: async (url, userId) => {
    const imageData = await parent.findOne({
      filter: {
        url,
        userId,
      },
    });

    if (isEmpty(imageData)) {
      throw newError(404, 'Image not found', {
        errorCode: 'image_not_found',
      });
    }

    return imageData;
  },
  extensions: parent.extensions.concat(['findByUrl']),
});

module.exports = { findByUrlExtension };
