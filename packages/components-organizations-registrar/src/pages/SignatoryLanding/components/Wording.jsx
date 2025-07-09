import { Typography } from '@mui/material';
import PropTypes from 'prop-types';

const SignatoryErrorCodes = {
  AUTH_CODE_MUST_BE_MOST_RECENT: 'auth_code_must_be_most_recent',
  AUTH_CODE_EXPIRED: 'auth_code_expired',
  UNAUTHORIZED: 'unauthorized',
  SIGNATORY_STATUS_ALREADY_COMPLETE: 'signatory_status_already_complete',
};

export const Wording = ({ response, errorCode, name }) => {
  if (errorCode === SignatoryErrorCodes.SIGNATORY_STATUS_ALREADY_COMPLETE) {
    return (
      <>
        <Typography variant="h1" textAlign="center" marginBottom={3.5}>
          This process has already been completed
        </Typography>
        <Typography variant="pL" textAlign="center" marginBottom={11}>
          If you have any queries please contact us for assistance.
        </Typography>
      </>
    );
  }

  if (
    [
      SignatoryErrorCodes.AUTH_CODE_MUST_BE_MOST_RECENT,
      SignatoryErrorCodes.AUTH_CODE_EXPIRED,
      SignatoryErrorCodes.UNAUTHORIZED,
    ].includes(errorCode)
  ) {
    return (
      <>
        <Typography variant="h1" textAlign="center" marginBottom={3.5}>
          This link has expired.
        </Typography>
        <Typography variant="pL" textAlign="center" marginBottom={11}>
          Please check your inbox for the most recent reminder email and use the updated link
          provided there to complete your action. <br />
          If you can’t find the latest email, please contact us for assistance.
        </Typography>
      </>
    );
  }

  return (
    <>
      <Typography variant="h1" textAlign="center" marginBottom={3.5}>
        Thank you!
      </Typography>
      <Typography variant="pL" textAlign="center" marginBottom={11}>
        Your {response === 'approve' ? 'approval' : 'rejection'} regarding the addition of {name} on
        the Velocity Network has been acknowledged.
      </Typography>
    </>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
Wording.propTypes = {
  response: PropTypes.string.isRequired,
  errorCode: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
};

export default Wording;
