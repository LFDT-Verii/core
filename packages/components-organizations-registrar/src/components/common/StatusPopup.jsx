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

import { Box, Typography, Button, useTheme } from '@mui/material';
import PropTypes from 'prop-types';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import Popup from './Popup.jsx';

const StatusPopup = ({
  isModalOpened,
  onButtonClick,
  onClose,
  title,
  subTitle,
  buttonLabel,
  error,
}) => {
  const theme = useTheme();

  return (
    <Popup
      onClose={onClose}
      title=""
      isOpen={isModalOpened}
      mainContainerStyles={styles.mainContainer}
      isBackBoxVisible
      backBoxColor={error ? theme.palette.error.main : theme.palette.success.main}
    >
      {error ? (
        <CancelIcon color="error" sx={styles.icon} />
      ) : (
        <CheckCircleIcon color="success" sx={styles.icon} />
      )}
      <Typography sx={styles.title}>{title}</Typography>
      {!!subTitle && (
        <Typography variant="ps" sx={styles.subtitle} textAlign="center">
          {subTitle}
        </Typography>
      )}

      <Box sx={styles.buttonBlock}>
        <Button variant="outlined" color="secondary" sx={styles.button} onClick={onButtonClick}>
          {buttonLabel}
        </Button>
      </Box>
    </Popup>
  );
};

const styles = {
  mainContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pt: '19px',
  },
  title: {
    fontWeight: 600,
    fontSize: '32px',
    lineHeight: '39px',
    textAlign: 'center',
    mb: '32px',
    mt: '35px',
  },
  subtitle: {
    pt: '20px',
    color: (theme) => theme.palette.text.secondary,
  },
  button: { px: 4, py: 1, fontSize: '16px' },
  buttonBlock: {
    marginTop: '20px',
  },
  icon: { width: '50px', height: '50px' },
};

// eslint-disable-next-line better-mutation/no-mutation
StatusPopup.propTypes = {
  isModalOpened: PropTypes.bool,
  onButtonClick: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  subTitle: PropTypes.string,
  buttonLabel: PropTypes.string.isRequired,
  error: PropTypes.string,
};

export default StatusPopup;
