const { createHash } = require('node:crypto');

const fingerprintJwt = (jwt) => createHash('sha256').update(jwt).digest('hex');

module.exports = { fingerprintJwt };
