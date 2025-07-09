const { initExecuteUpdate } = require('./execute-update');
const { prepareData } = require('./prepare-data');
const { loadCsv, printInfo } = require('../helpers');

// eslint-disable-next-line consistent-return
const executeVendorCredentials = async (options) => {
  const [csvHeaders, csvRows] = await loadCsv(options.csvFilename);
  const updates = await prepareData(csvHeaders, csvRows, options);

  if (options.endpoint == null) {
    printInfo(JSON.stringify({ updates }));
    return updates;
  }

  const executeUpdate = initExecuteUpdate(options);
  for (const update of updates) {
    // eslint-disable-next-line no-await-in-loop
    await executeUpdate(update);
  }
};

module.exports = { executeVendorCredentials };
