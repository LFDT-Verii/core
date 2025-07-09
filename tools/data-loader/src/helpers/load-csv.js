const fs = require('fs');
const csv = require('csv-parser');
const stripBom = require('strip-bom-stream');
const { isString, indexOf } = require('lodash/fp');

const loadCsv = (fileName) => {
  return new Promise((resolve, reject) => {
    const csvRows = [];
    let csvHeaders;
    fs.createReadStream(fileName)
      .pipe(stripBom())
      .pipe(csv())
      .on('headers', (headers) => {
        // eslint-disable-next-line better-mutation/no-mutation
        csvHeaders = headers;
      })
      .on('data', (data) => {
        // eslint-disable-next-line better-mutation/no-mutating-methods
        csvRows.push(data);
      })
      .on('err', (err) => reject(err))
      .on('end', () => {
        resolve([csvHeaders, csvRows]);
      });
  });
};

const getColIndex = (csvHeaders, column) =>
  isString(column) ? indexOf(column, csvHeaders) : column;

const getColName = (csvHeaders, column) =>
  isString(column) ? column : csvHeaders[column];

module.exports = { loadCsv, getColIndex, getColName };
