import { MESSAGE_CODES } from '@/constants/messageCodes';

export const getStatusByCode = (errorCode) => {
  switch (errorCode) {
    case MESSAGE_CODES.BAD_INVITEE_EMAIL: {
      return 'The email address is invalid and the invitation was not sent';
    }
    case MESSAGE_CODES.INVITATION_SENT: {
      return 'The invitation was sent';
    }
    case MESSAGE_CODES.INVITATION_NOT_SENT: {
      return 'Invitation was not sent. Check the email address';
    }

    default:
      return 'The invitation was not sent';
  }
};

export default getStatusByCode;
