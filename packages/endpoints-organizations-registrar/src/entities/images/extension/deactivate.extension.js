const { isEmpty } = require('lodash/fp');
const { ImageState } = require('../domain');

const deactivateExtension = (parent) => ({
  deactivate: async (url) => {
    const image = await parent.findOne({
      filter: {
        url,
      },
    });
    if (isEmpty(image)) {
      return;
    }
    await parent.collection().updateOne(
      { url },
      {
        $set: {
          updatedAt: new Date(),
          state: ImageState.INACTIVE,
        },
      }
    );
  },
  extensions: parent.extensions.concat(['deactivate']),
});

module.exports = { deactivateExtension };
