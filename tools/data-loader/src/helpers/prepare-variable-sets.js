const { map } = require('lodash/fp');
const { getColName } = require('./load-csv');

const prepareVariableSets = async (
  csvHeaders,
  csvRows,
  { vendorUseridColumn, vars, did }
) => {
  const overrideVars = { ...vars };
  if (did != null) {
    overrideVars.did = did;
  }
  return map(
    (csvRow) => ({
      ...csvRow,
      ...overrideVars,
      vendorUserId: csvRow[getColName(csvHeaders, vendorUseridColumn)],
    }),
    csvRows
  );
};

module.exports = { prepareVariableSets };
