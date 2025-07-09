const parseColumn = (value) => {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    return value;
  }
  return parsedValue;
};
module.exports = { parseColumn };
