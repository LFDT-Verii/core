const { MongoClient } = require('mongodb');

const initMongoClient = (mongoUrl) => {
  return MongoClient.connect(mongoUrl);
};

module.exports = { initMongoClient };
