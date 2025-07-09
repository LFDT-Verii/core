const fsPromises = require('fs').promises;
const { join } = require('path');
const fs = require('fs');

const OUTPUT_CSV_HEADERS = ['deeplink', 'qrcodepath'];

const writeQrCodeFile = async (identifier, qrcode, { path }) => {
  const fileName = `${identifier}.png`;
  const filePath = join(path, fileName);
  await fsPromises.writeFile(filePath, qrcode);
  return { fileName, filePath };
};

const writeJsonFile = async (obj, jsonName, { path }) => {
  const fileName = `${jsonName}.json`;
  const filePath = join(path, fileName);
  await fsPromises.writeFile(filePath, JSON.stringify(obj));
  return { fileName, filePath };
};

const writeOutputCsv = (data, { path, outputCsvName, vendorUserIdColName }) => {
  const fileName = `${outputCsvName}.csv`;
  const filePath = join(path, fileName);
  const buff = fs.createWriteStream(filePath, {});
  buff.write([vendorUserIdColName, ...OUTPUT_CSV_HEADERS].join(','));
  for (const { vendorUserId, deeplink, qrcodeFilePath } of data) {
    buff.write(`\n${vendorUserId},${deeplink},${qrcodeFilePath}`);
  }
  buff.end();

  return { filePath };
};

module.exports = { writeQrCodeFile, writeOutputCsv, writeJsonFile };
