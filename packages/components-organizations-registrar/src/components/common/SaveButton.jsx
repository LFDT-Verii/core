import { SaveButton as SaveButtonBase } from 'react-admin';
import PropTypes from 'prop-types';
import Loading from '../Loading.jsx';

export const Save = ({ saveInProgress, isDisabled, label = 'Save' }) => {
  return (
    <SaveButtonBase
      variant="outlined"
      alwaysEnable={!isDisabled}
      disabled={isDisabled}
      icon={null}
      endIcon={saveInProgress ? <Loading color="error" sx={styles.loader} size={26} /> : null}
      label={label}
      sx={[styles.button, styles.saveButton, isDisabled && styles.saveButtonDisabled]}
    />
  );
};

// eslint-disable-next-line better-mutation/no-mutation
Save.propTypes = {
  saveInProgress: PropTypes.bool,
  isDisabled: PropTypes.bool,
  label: PropTypes.string,
};

const styles = {
  button: { px: 4, py: 1, fontSize: '16px', width: '160px', fontWeight: '600' },
  saveButton: {
    display: 'flex',
    flexDirection: 'row-reverse',
    gap: '10px',
    '&:disabled': {
      color: 'text.disabled',
      borderColor: 'secondary.light',
    },
  },
  saveButtonDisabled: {
    '&:disabled': {
      color: 'text.disabled',
      borderColor: 'secondary.light',
    },
  },
};

export default Save;
