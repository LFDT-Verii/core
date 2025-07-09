const normalizeProfileName = (name) =>
  name.replace(/\s+/g, ' ').toLowerCase().trim();
module.exports = {
  normalizeProfileName,
};
