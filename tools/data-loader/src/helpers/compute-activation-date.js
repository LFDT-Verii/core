const { flow } = require('lodash/fp');
const { addHours } = require('date-fns/fp');

const computeActivationDate = ({
  activatesInHours = 0 /* by default activate immediately */,
}) => {
  return flow(addHours(activatesInHours))(new Date());
};

module.exports = {
  computeActivationDate,
};
