const newMockvendorOffer = require('./new-mockvendor-offer.schema');

module.exports = async (fastify) => {
  fastify.addSchema(newMockvendorOffer);
};
