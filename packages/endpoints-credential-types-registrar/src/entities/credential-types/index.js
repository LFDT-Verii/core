// TODO If we create a keys entity package, most of the stuff in this directory should probably be moved to there
module.exports = {
  ...require('./domains'),
  ...require('./orchestrators'),
  ...require('./repos'),
};
