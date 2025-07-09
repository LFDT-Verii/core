const newError = require('http-errors');

const initBasicAuthValidate =
  (configUsername, configPassword) => async (username, password) => {
    if (username !== configUsername || password !== configPassword) {
      throw new newError.Forbidden('Wrong username or password');
    }
  };

module.exports = {
  initBasicAuthValidate,
};
