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

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';

const sxStyles = {
  mainContainer: { py: 6, px: 6, position: 'relative', overflow: 'auto' },
  title: { fontWeight: 600, fontSize: '32px', lineHeight: '39px', pb: 3, px: 0, pt: 0 },
  iconButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    color: (theme) => theme.palette.grey[500],
  },
  backFixedBox: {
    position: 'absolute',
    top: '-12px',
    left: '25px',
    width: 'calc(100% - 50px)',
    height: '12px',
    borderRadius: '12px 12px 0 0 ',
  },
};

const Popup = ({
  title,
  onClose,
  isOpen,
  children,
  topComponents,
  mainContainerStyles = {},
  titleStyles = {},
  isBackBoxVisible = false,
  backBoxColor,
  disableCloseButton = false,
}) => {
  return (
    <Dialog
      onClose={onClose}
      open={isOpen}
      PaperProps={{
        sx: {
          overflow: 'unset',
          maxWidth: '700px',
        },
      }}
    >
      {isBackBoxVisible && <Box sx={[sxStyles.backFixedBox, { backgroundColor: backBoxColor }]} />}
      <Box sx={[sxStyles.mainContainer, mainContainerStyles]}>
        <DialogTitle sx={[sxStyles.title, titleStyles]}>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={sxStyles.iconButton}
            disabled={disableCloseButton}
          >
            <CloseIcon />
          </IconButton>
          {topComponents}
          {title}
        </DialogTitle>
        {children}
      </Box>
    </Dialog>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
Popup.propTypes = {
  onClose: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  topComponents: PropTypes.node,
  // eslint-disable-next-line react/forbid-prop-types
  mainContainerStyles: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  titleStyles: PropTypes.object,
  isBackBoxVisible: PropTypes.bool,
  backBoxColor: PropTypes.string,
  disableCloseButton: PropTypes.bool,
};

export default Popup;
