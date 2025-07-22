const {
  initReadDocument,
  initWriteDocument,
} = require('@verii/aws-clients');

const initDocumentFunctions = ({ eventName }, context) => {
  const readDocument = initReadDocument(context.config);
  const writeDocument = initWriteDocument(context.config);
  const readLastSuccessfulBlock = async () => {
    const result = await readDocument(context.config.dynamoDbTableEventBlock, {
      EventName: eventName,
    });
    context.log.info({ result });

    if (!result || !result.Item) {
      return -1;
    }
    return result.Item.BlockNumber;
  };
  const writeLastSuccessfulBlock = (blockNumber) =>
    writeDocument(context.config.dynamoDbTableEventBlock, {
      EventName: eventName,
      BlockNumber: blockNumber,
    });

  return { readLastSuccessfulBlock, writeLastSuccessfulBlock };
};

module.exports = {
  initDocumentFunctions,
};
