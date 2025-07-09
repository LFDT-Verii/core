const fsPromises = require('fs').promises;
const { join } = require('path');

const loadFilePath = (jsonName, { path }) => {
  const fileName = `${jsonName}.json`;
  return join(path, fileName);
};

const readJsonFile = async ({ filePath, jsonName }, options) => {
  const readFilePath = filePath ?? loadFilePath(jsonName, options);
  const jsonString = await fsPromises.readFile(readFilePath);
  return JSON.parse(jsonString);
};

module.exports = { readJsonFile };
