class PublicError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.publicCode = code;
  }
}

module.exports = { PublicError };
