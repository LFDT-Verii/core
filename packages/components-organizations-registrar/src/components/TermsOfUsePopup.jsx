/*
 * Copyright 2025 Velocity Team
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
 *
 */

import PropTypes from 'prop-types';
import { Button, Typography, Stack, Box } from '@mui/material';
import { Link } from 'react-router';

import { Download } from '@mui/icons-material';
import Popup from './common/Popup.jsx';
import theme from '../theme/theme';

const TermsOfUsePopup = ({ onClose, isOpen, onProceed, title, onDownload }) => {
  return (
    <Popup title={title} onClose={onClose} isOpen={isOpen} titleStyles={sx.title}>
      <Stack justifyContent="center" pt="8px">
        <Typography alignSelf="center">
          By clicking PROCEED you agree to the{' '}
          <Link target="_blank" to="/terms-and-conditions" role="link" style={sx.link}>
            terms of use
          </Link>
        </Typography>
        <Box sx={sx.box}>
          <Button onClick={onProceed} variant="outlined" sx={[sx.button, sx.proceed]} autoFocus>
            Proceed
          </Button>
          <Button onClick={onDownload} variant="outlined" sx={sx.button} endIcon={<Download />}>
            Download PDF
          </Button>
        </Box>
      </Stack>
    </Popup>
  );
};

const sx = {
  button: {
    width: 'fit-content',
    alignSelf: 'center',
    px: 4,
    py: 1,
    mt: '40px',
    mr: 2,
    '&:last-child': {
      mr: 0,
    },
    color: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
  box: {
    display: 'flex',
    justifyContent: 'center',
  },
  link: { color: theme.palette.primary.main },
  title: { textAlign: 'center' },
  proceed: {
    color: theme.palette.text.primary,
    borderColor: theme.palette.secondary.light,
    '&:hover': {
      borderColor: theme.palette.secondary.light,
    },
  },
};

// eslint-disable-next-line better-mutation/no-mutation
TermsOfUsePopup.propTypes = {
  onClose: PropTypes.func,
  onProceed: PropTypes.func,
  isOpen: PropTypes.bool,
  title: PropTypes.string,
  onDownload: PropTypes.func,
};

export default TermsOfUsePopup;
