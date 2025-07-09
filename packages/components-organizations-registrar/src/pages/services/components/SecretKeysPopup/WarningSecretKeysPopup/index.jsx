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
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import PropTypes from 'prop-types';

import Popup from '@/components/common/Popup.jsx';
import Loading from '@/components/Loading.jsx';

const titleDefault =
  'Wait! Before you close this window, please make sure you have saved a copy of your keys';
const subTitleDefault =
  // eslint-disable-next-line max-len
  'Your organization’s unique keys are critical for managing your organization’s data on Velocity Network™. This information will not be available once you close this window.';
const buttonLabelDefault = 'Download keys';

const WarningSecretKeysPopup = ({
  isModalOpened,
  onClose,
  title = titleDefault,
  subTitle = subTitleDefault,
  buttonLabel = buttonLabelDefault,
  isLoading = false,
  onClick,
}) => {
  const theme = useTheme();

  return (
    <Popup
      onClose={onClose}
      title=""
      isOpen={isModalOpened}
      mainContainerStyles={styles.mainContainer}
      isBackBoxVisible
      backBoxColor={theme.palette.warning.main}
      disableCloseButton={isLoading}
    >
      <InfoIcon color="warning" sx={styles.icon} />
      <Typography sx={styles.title}>{title}</Typography>
      <Typography textAlign="center">{subTitle}</Typography>

      <Box sx={styles.buttonBlock}>
        <Button
          variant="outlined"
          endIcon={
            isLoading ? <Loading color="error" sx={styles.loader} size={26} /> : <DownloadIcon />
          }
          disabled={isLoading}
          sx={styles.button}
          onClick={onClick}
        >
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
  button: { px: 4, py: 1, fontSize: '16px' },
  buttonBlock: {
    marginTop: '52px',
  },
  icon: { width: '50px', height: '50px' },
  loader: { pl: '10px' },
};

// eslint-disable-next-line better-mutation/no-mutation
WarningSecretKeysPopup.propTypes = {
  isModalOpened: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  onClose: PropTypes.func,
  title: PropTypes.string,
  subTitle: PropTypes.string,
  buttonLabel: PropTypes.string,
  isLoading: PropTypes.bool,
  onClick: PropTypes.func,
};

export default WarningSecretKeysPopup;
