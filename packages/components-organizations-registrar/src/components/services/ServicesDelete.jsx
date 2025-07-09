/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Button, Typography, Stack } from '@mui/material';
import PropTypes from 'prop-types';

import Popup from '../common/Popup.jsx';

const ServicesDelete = ({ onClose, onConfirm, selectedService, isLoading }) => {
  return (
    <Popup
      title="Delete service"
      onClose={isLoading ? () => {} : onClose}
      isOpen={Boolean(selectedService)}
    >
      <Typography>Are you sure you want to delete {selectedService} service?</Typography>
      <Stack sx={styles.buttonBlock}>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          variant="outlined"
          sx={styles.button}
          autoFocus
        >
          Delete
        </Button>
        <Button
          onClick={onClose}
          disabled={isLoading}
          variant="outlined"
          sx={[styles.button, styles.cancelButton]}
        >
          Cancel
        </Button>
      </Stack>
    </Popup>
  );
};

const styles = {
  buttonBlock: {
    display: 'flex',
    flexDirection: 'row-reverse',
    marginTop: '40px',
    justifyContent: 'center',
  },
  button: {
    px: 4,
    py: 1,
    fontSize: '16px',
    width: '160px',
  },
  cancelButton: { marginRight: '20px', color: 'text.primary', borderColor: 'secondary.light' },
};

// eslint-disable-next-line better-mutation/no-mutation
ServicesDelete.propTypes = {
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  selectedService: PropTypes.object,
  isLoading: PropTypes.bool,
};

export default ServicesDelete;
