const newError = require('http-errors');

const validateInviteeEmail = (email) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) {
    throw newError(
      400,
      'The email address is invalid and the invitation was not sent',
      {
        errorCode: 'bad_invitee_email',
      }
    );
  }
};

module.exports = {
  validateInviteeEmail,
};
