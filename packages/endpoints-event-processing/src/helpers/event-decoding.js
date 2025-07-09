const { jwtDecode } = require('@verii/jwt');

const decodeBigIntToNumber = (bigInt) => Number(bigInt.hex);

const decodeBigIntToDate = (bigInt) => new Date(Number(bigInt.hex) * 1000);

const hexStringToUtfString = (hexString) =>
  Buffer.from(hexString, 'hex').toString();

const decodeIssuerVc = (issuerVc) => {
  const { payload } = jwtDecode(hexStringToUtfString(issuerVc.slice(2)));

  return payload?.iss;
};

module.exports = {
  decodeBigIntToNumber,
  decodeBigIntToDate,
  decodeIssuerVc,
};
