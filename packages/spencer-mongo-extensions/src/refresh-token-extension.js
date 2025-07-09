const { hashAndEncodeHex } = require('@verii/crypto');

const refreshTokenExtension = (parent) => {
  return {
    prepFilter: (filter) => {
      return parent.prepFilter(hashRefreshTokenField(filter));
    },
    prepModification: (val, ...args) => {
      return parent.prepModification(hashRefreshTokenField(val), ...args);
    },
  };
};

const hashRefreshTokenField = (obj) => {
  const updatedFilter = {
    ...obj,
  };
  if (obj.refreshToken) {
    updatedFilter.refreshToken = hashAndEncodeHex(obj.refreshToken);
  }
  return updatedFilter;
};

module.exports = {
  refreshTokenExtension,
  hashRefreshTokenField,
};
